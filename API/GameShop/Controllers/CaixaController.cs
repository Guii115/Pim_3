using API.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace API.Controllers;

[Authorize]
[ApiController]
[Route("api/caixa")] // <-- ISSO AQUI garante que o JavaScript ache /api/caixa
public class CaixaController(CaixaRepository repo) : ControllerBase
{
    [HttpGet("aberto")] // <-- ISSO AQUI mapeia /api/caixa/aberto
    public IActionResult GetAberto()
    {
        try
        {
            var caixa = repo.GetAberto();
            if (caixa is null)
                // Se não houver caixa aberto, retornamos um objeto vazio ou 204
                // para o JavaScript não estourar erro na tela
                return Ok(new { mensagem = "Nenhum caixa aberto" });

            return Ok(caixa);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { codigo = 500, mensagem = "Erro ao buscar o caixa aberto.", detalhe = ex.Message });
        }
    }

    [HttpPost("abrir")] // <-- ISSO AQUI mapeia /api/caixa/abrir
    public IActionResult Abrir([FromQuery] int idFuncionario, [FromBody] decimal valorInicial)
    {
        try
        {
            // Se o javascript enviar apenas o valor direto no body (ex: api('POST', '/caixa/abrir', valor))
            // você pode pegar o id do funcionário do token ou usar o ID 1 (Admin) temporariamente para testes
            var id = int.Parse(User.FindFirstValue("funcionario_id") ?? "1");
            var caixaId = repo.Abrir(id, valorInicial);
            return Ok(new { id = caixaId, mensagem = "Caixa aberto com sucesso." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { codigo = 500, mensagem = "Erro ao abrir o caixa.", detalhe = ex.Message });
        }
    }

    [HttpPost("fechar/{id}")] // <-- ISSO AQUI mapeia /api/caixa/fechar/{id}
    public IActionResult Fechar(int id, [FromQuery] int idFuncionario)
    {
        try
        {
            var fid = int.Parse(User.FindFirstValue("funcionario_id") ?? "1");
            var caixa = repo.Fechar(id, fid);
            if (caixa is null)
                return NotFound(new { codigo = 404, mensagem = "Caixa não encontrado ou já fechado." });

            return Ok(caixa);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { codigo = 500, mensagem = "Erro ao fechar o caixa.", detalhe = ex.Message });
        }
    }
}