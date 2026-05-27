using API.Models;
using API.DTOs;
using API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace API.Controllers;

[Authorize]
[ApiController]
[Route("api/venda")]
public class VendaController(VendaService svc) : ControllerBase
{
    [HttpGet]
    public IActionResult Listar([FromQuery] DateTime? de, [FromQuery] DateTime? ate)
    {
        try
        {
            var vendas = svc.Listar(de, ate);
            return Ok(vendas);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { codigo = 500, mensagem = "Erro ao buscar histórico de vendas.", detalhe = ex.Message });
        }
    }

    [HttpGet("{id}")]
    public IActionResult BuscarPorId(int id)
    {
        try
        {
            if (id <= 0)
                return BadRequest(new { codigo = 400, mensagem = "ID da venda inválido." });

            var v = svc.BuscarPorId(id);
            if (v is null)
                return NotFound(new { codigo = 404, mensagem = $"Venda com ID {id} não encontrada." });

            return Ok(v);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { codigo = 500, mensagem = "Erro ao buscar venda.", detalhe = ex.Message });
        }
    }

    [HttpPost]
    public IActionResult Registrar([FromBody] VendaRequest req)
    {
        try
        {
            if (req.Itens is null || req.Itens.Count == 0)
                return BadRequest(new { codigo = 400, mensagem = "A venda deve ter pelo menos um item." });

            foreach (var item in req.Itens)
            {
                if (item.IdProduto <= 0)
                    return BadRequest(new { codigo = 400, mensagem = "ID de produto inválido no carrinho." });
                if (item.Quantidade <= 0)
                    return BadRequest(new { codigo = 400, mensagem = $"Quantidade inválida para o produto ID {item.IdProduto}." });
            }

            var formasValidas = new[] { "dinheiro", "pix", "debito", "credito" };
            if (!formasValidas.Contains(req.FormaPagamento.ToLower()))
                return BadRequest(new { codigo = 400, mensagem = "Forma de pagamento inválida. Use: dinheiro, pix, debito ou credito." });

            if (req.Desconto < 0)
                return BadRequest(new { codigo = 400, mensagem = "O desconto não pode ser negativo." });

            if (req.FormaPagamento.ToLower() == "dinheiro" && (req.ValorPago is null || req.ValorPago <= 0))
                return BadRequest(new { codigo = 400, mensagem = "Informe o valor pago para pagamento em dinheiro." });

            var usuarioId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

            var venda = new Venda
            {
                IdCliente = req.IdCliente,
                Desconto = req.Desconto,
                FormaPagamento = req.FormaPagamento.ToLower(),
                ValorPago = req.ValorPago,
                Total = 0, // Será recalculado e atualizado dentro do repositório
                IdUsuario = usuarioId
            };

            var id = svc.Registrar(venda, req.Itens);
            return Ok(new { id, mensagem = "Venda registrada com sucesso." });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { codigo = 400, mensagem = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { codigo = 500, mensagem = "Erro ao registrar venda.", detalhe = ex.Message });
        }
    }
}