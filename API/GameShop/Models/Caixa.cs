namespace API.Models;

public class Caixa
{
    public int Id { get; set; }
    public DateTime DataAbertura { get; set; }
    public DateTime? DataFechamento { get; set; }
    public decimal ValorInicial { get; set; }
    public decimal TotalDinheiro { get; set; }
    public decimal TotalPix { get; set; }
    public decimal TotalDebito { get; set; }
    public decimal TotalCredito { get; set; }
    public decimal TotalGeral { get; set; }
    public string Status { get; set; } = "aberto";
    public int IdFuncionario { get; set; }
}