namespace API.Models;

public class Cliente
{
    public int Id { get; set; }
    public string Nome { get; set; } = "";
    public string? CpfCnpj { get; set; }
    public string? Telefone { get; set; }
    public string? Email { get; set; }
}