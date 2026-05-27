namespace API.DTOs;

public record DashboardResponse(
    int TotalProdutos,
    int EstoqueBaixo,
    int VendasHoje,
    decimal FaturamentoHoje,
    decimal FaturamentoMes
);