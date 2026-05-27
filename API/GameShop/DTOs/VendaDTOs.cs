namespace API.DTOs;

public record ItemVendaRequest(int IdProduto, int Quantidade);

public record VendaRequest(
    int? IdCliente,
    decimal Desconto,
    string FormaPagamento,
    decimal? ValorPago,
    List<ItemVendaRequest> Itens
);