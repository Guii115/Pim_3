using API.Models;
using API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers;

[Authorize]
[ApiController]
[Route("api/produto")]
public class ProdutoController(ProdutoService svc) : ControllerBase
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
            return StatusCode(500, new { codigo = 500, mensagem = "Erro ao buscar lista de produtos.", detalhe = ex.Message });
        }
    }

    [HttpGet("{id}")]
    public IActionResult BuscarPorId(int id)
    {
        try
        {
            if (id <= 0)
                return BadRequest(new { codigo = 400, mensagem = "ID do produto inválido." });

            var p = svc.BuscarPorId(id);
            if (p is null)
                return NotFound(new { codigo = 404, mensagem = $"Produto com ID {id} não encontrado." });

            return Ok(p);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { codigo = 500, mensagem = "Erro ao buscar produto.", detalhe = ex.Message });
        }
    }

    [HttpGet("estoque-baixo")]
    public IActionResult EstoqueBaixo()
    {
        try
        {
            return Ok(svc.EstoqueBaixo());
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { codigo = 500, mensagem = "Erro ao buscar produtos com estoque baixo.", detalhe = ex.Message });
        }
    }

    [HttpGet("proximo-codigo")]
    public IActionResult ProximoCodigo()
    {
        try
        {
            return Ok(new { codigo = svc.ProximoCodigo() });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { codigo = 500, mensagem = "Erro ao gerar código do produto.", detalhe = ex.Message });
        }
    }

    [HttpPost]
    public IActionResult Inserir([FromBody] Produto p)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(p.Nome))
                return BadRequest(new { codigo = 400, mensagem = "O nome do produto é obrigatório." });

            if (p.Preco <= 0)
                return BadRequest(new { codigo = 400, mensagem = "O preço do produto deve ser maior que zero." });

            if (p.QuantidadeEstoque < 0)
                return BadRequest(new { codigo = 400, mensagem = "A quantidade em estoque não pode ser negativa." });

            svc.Inserir(p);
            return Ok(new { mensagem = "Produto cadastrado com sucesso." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { codigo = 500, mensagem = "Erro ao cadastrar produto. Verifique os dados e tente novamente.", detalhe = ex.Message });
        }
    }

    [HttpPut("{id}")]
    public IActionResult Atualizar(int id, [FromBody] Produto p)
    {
        try
        {
            if (id <= 0)
                return BadRequest(new { codigo = 400, mensagem = "ID do produto inválido." });

            if (string.IsNullOrWhiteSpace(p.Nome))
                return BadRequest(new { codigo = 400, mensagem = "O nome do produto é obrigatório." });

            if (p.Preco <= 0)
                return BadRequest(new { codigo = 400, mensagem = "O preço do produto deve ser maior que zero." });

            if (p.QuantidadeEstoque < 0)
                return BadRequest(new { codigo = 400, mensagem = "A quantidade em estoque não pode ser negativa." });

            var atualizado = svc.Atualizar(id, p);
            if (!atualizado)
                return NotFound(new { codigo = 404, mensagem = $"Produto com ID {id} não encontrado para atualização." });

            return Ok(new { mensagem = "Produto atualizado com sucesso." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { codigo = 500, mensagem = "Erro ao atualizar produto.", detalhe = ex.Message });
        }
    }

    [HttpDelete("{id}")]
    public IActionResult Deletar(int id)
    {
        try
        {
            if (id <= 0)
                return BadRequest(new { codigo = 400, mensagem = "ID do produto inválido." });

            var deletado = svc.Deletar(id);
            if (!deletado)
                return NotFound(new { codigo = 404, mensagem = $"Produto com ID {id} não encontrado para exclusão." });

            return Ok(new { mensagem = "Produto removido com sucesso." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { codigo = 500, mensagem = "Erro ao remover produto.", detalhe = ex.Message });
        }
    }
}