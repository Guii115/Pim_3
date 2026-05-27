namespace API.Models;

public class Venda
{
    public int Id { get; set; }
    public DateTime DataVenda { get; set; }
    public decimal Total { get; set; }
    public decimal Desconto { get; set; }
    public string FormaPagamento { get; set; } = "";
    public decimal? ValorPago { get; set; }
    public decimal Troco { get; set; }
    public string Status { get; set; } = "concluida";
    public int? IdCliente { get; set; }
    public string? NomeCliente { get; set; }
    public int IdUsuario { get; set; }
    public List<ItemVenda> Itens { get; set; } = [];
}

public class ItemVenda
{
    public int IdProduto { get; set; }
    public string? NomeProduto { get; set; }
    public int Quantidade { get; set; }
    public decimal PrecoUnit { get; set; }
    public decimal Subtotal { get; set; }
}