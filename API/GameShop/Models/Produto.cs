namespace API.Models;

public class Produto
{
    public int Id { get; set; }
    public string? CodigoFiscal { get; set; }
    public string Nome { get; set; } = "";
    public string? Plataforma { get; set; }
    public decimal Preco { get; set; }
    public int QuantidadeEstoque { get; set; }
    public int EstoqueMinimo { get; set; }
    public string? FotoUrl { get; set; }
    public int? IdCategoria { get; set; }
    public string? NomeCategoria { get; set; } // preenchido no SELECT
    public int? IdFornecedor { get; set; }
    public string? NomeFornecedor { get; set; } // preenchido no SELECT
}