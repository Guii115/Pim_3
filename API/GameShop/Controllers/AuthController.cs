using API.DTOs;
using API.Repositories;
using API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Distributed;
using System.Security.Claims;
using System.Text.Json;

namespace API.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(UsuarioRepository repo, TokenService tokenSvc, IDistributedCache cache) : ControllerBase
{
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest req)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(req.Login) || string.IsNullOrWhiteSpace(req.Senha))
                return BadRequest(new { codigo = 400, mensagem = "Login e senha são obrigatórios." });

            var usuario = repo.GetByLogin(req.Login);

            if (usuario is null)
                return Unauthorized(new { codigo = 401, mensagem = "Usuário não encontrado. Verifique o login informado." });

            if (!usuario.Ativo)
                return Unauthorized(new { codigo = 401, message = "Usuário inativo. Entre em contato com o administrador." });

            if (!BCrypt.Net.BCrypt.Verify(req.Senha, usuario.SenhaHash))
                return Unauthorized(new { codigo = 401, mensagem = "Senha incorreta. Tente novamente." });

            // 1. Gera o Token JWT tradicional da sua regra de negócio
            var token = tokenSvc.GerarToken(usuario);

            // 2. Monta o objeto de dados que vai virar o JSON armazenado no Redis
            var dadosSessao = new
            {
                IdUsuario = usuario.Id,
                Login = usuario.Login,
                Nome = usuario.NomeFuncionario,
                Cargo = usuario.Cargo,
                DataLogin = DateTime.UtcNow
            };

            string jsonPayload = JsonSerializer.Serialize(dadosSessao);

            // 3. REGRA DE SESSÃO: Gerente (8 horas = 28800s) | Funcionário (5 minutos = 300s)
            int segundosExpiracao = usuario.Cargo.ToLower() == "gerente" ? 28800 : 300;

            var cacheOptions = new DistributedCacheEntryOptions
            {
                SlidingExpiration = TimeSpan.FromSeconds(segundosExpiracao) // Garante a renovação automática (Sliding)
            };

            // 4. Salva a string JSON no Redis usando o token como chave
            await cache.SetStringAsync(token, jsonPayload, cacheOptions);

            return Ok(new LoginResponse(token, usuario.NomeFuncionario, usuario.Cargo));
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { codigo = 500, mensagem = "Erro interno ao realizar login.", detalhe = ex.Message });
        }
    }

    [Authorize]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        try
        {
            // Remove o token do cache do Redis imediatamente para invalidar cliques futuros
            var authHeader = Request.Headers["Authorization"].ToString();
            if (authHeader.StartsWith("Bearer "))
            {
                var token = authHeader.Substring(7);
                await cache.RemoveAsync(token);
            }

            var id = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            tokenSvc.RevogarToken(id);

            return Ok(new { mensagem = "Sessão encerrada com sucesso." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { codigo = 500, mensagem = "Erro ao encerrar sessão.", detalhe = ex.Message });
        }
    }

    [HttpGet("hash-teste/{senha}")]
    public IActionResult HashTeste(string senha)
    {
        return Ok(new { hash = BCrypt.Net.BCrypt.HashPassword(senha) });
    }
}