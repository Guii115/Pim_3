namespace API.Models;

public class Usuario
{
    public int Id { get; set; }
    public string Login { get; set; } = "";
    public string SenhaHash { get; set; } = "";
    public bool Ativo { get; set; } = true;
    public int IdFuncionario { get; set; }
    public string NomeFuncionario { get; set; } = "";
    public string Cargo { get; set; } = "";
}