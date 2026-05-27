using API.Models;
using API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers;

[Authorize]
[ApiController]
[Route("api/cliente")]
public class ClienteController(ClienteService svc) : ControllerBase
{
    [HttpGet]
    public IActionResult Listar()
    {
        try
        {
            return Ok(svc.Listar());
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { codigo = 500, mensagem = "Erro ao buscar lista de clientes.", detalhe = ex.Message });
        }
    }

    [HttpGet("{id}")]
    public IActionResult BuscarPorId(int id)
    {
        try
        {
            if (id <= 0)
                return BadRequest(new { codigo = 400, mensagem = "ID do cliente inválido." });

            var c = svc.BuscarPorId(id);
            if (c is null)
                return NotFound(new { codigo = 404, message = $"Cliente com ID {id} não encontrado." });

            return Ok(c);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { codigo = 500, mensagem = "Erro ao buscar cliente.", detalhe = ex.Message });
        }
    }

    [HttpGet("cpf/{cpf}")]
    public IActionResult BuscarPorCpf(string cpf)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(cpf))
                return BadRequest(new { codigo = 400, mensagem = "CPF não informado." });

            var cpfLimpo = cpf.Replace(".", "").Replace("-", "").Trim();
            if (cpfLimpo.Length != 11)
                return BadRequest(new { codigo = 400, mensagem = "CPF inválido. Informe um CPF com 11 dígitos." });

            var c = svc.BuscarPorCpf(cpfLimpo);
            if (c is null)
                return NotFound(new { codigo = 404, mensagem = "Cliente não encontrado com o CPF informado." });

            return Ok(c);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { codigo = 500, mensagem = "Erro ao buscar cliente por CPF.", detalhe = ex.Message });
        }
    }

    [HttpPost]
    public IActionResult Inserir([FromBody] Cliente c)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(c.Nome))
                return BadRequest(new { codigo = 400, mensagem = "O nome do cliente é obrigatório." });

            if (string.IsNullOrWhiteSpace(c.CpfCnpj))
                return BadRequest(new { codigo = 400, mensagem = "O CPF do cliente é obrigatório." });

            var cpfLimpo = c.CpfCnpj.Replace(".", "").Replace("-", "").Trim();
            if (cpfLimpo.Length != 11)
                return BadRequest(new { codigo = 400, mensagem = "CPF inválido. Informe um CPF com 11 dígitos." });

            var existente = svc.BuscarPorCpf(cpfLimpo);
            if (existente is not null)
                return Conflict(new { codigo = 409, mensagem = "Já existe um cliente cadastrado com este CPF." });

            c.CpfCnpj = cpfLimpo;
            svc.Inserir(c);
            return Ok(new { mensagem = "Cliente cadastrado com sucesso." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { codigo = 500, mensagem = "Erro ao cadastrar cliente.", detalhe = ex.Message });
        }
    }

    [HttpPut("{id}")]
    public IActionResult Atualizar(int id, [FromBody] Cliente c)
    {
        try
        {
            if (id <= 0)
                return BadRequest(new { codigo = 400, mensagem = "ID do cliente inválido." });

            if (string.IsNullOrWhiteSpace(c.Nome))
                return BadRequest(new { codigo = 400, mensagem = "O nome do cliente é obrigatório." });

            var atualizado = svc.Atualizar(id, c);
            if (!atualizado)
                return NotFound(new { codigo = 404, mensagem = $"Cliente com ID {id} não encontrado para atualização." });

            return Ok(new { mensagem = "Cliente atualizado com sucesso." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { codigo = 500, mensagem = "Erro ao atualizar cliente.", detalhe = ex.Message });
        }
    }

    [HttpDelete("{id}")]
    public IActionResult Excluir(int id)
    {
        try
        {
            if (id <= 0)
                return BadRequest(new { codigo = 400, mensagem = "ID do cliente inválido." });

            var excluido = svc.Excluir(id);
            if (!excluido)
                return NotFound(new { codigo = 404, mensagem = $"Cliente com ID {id} não encontrado para exclusão." });

            return Ok(new { mensagem = "Cliente removido com sucesso." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { codigo = 500, mensagem = "Erro ao excluir cliente.", detalhe = ex.Message });
        }
    }
}