using API.Models;
using API.Repositories;

namespace API.Services;

public class CaixaService(CaixaRepository repo)
{
    public Caixa? BuscarAberto(int idFuncionario) => repo.GetAberto(idFuncionario);
    public int Abrir(int idFuncionario, decimal valorInicial) => repo.Abrir(idFuncionario, valorInicial);
    public Caixa? Fechar(int id, int idFuncionario) => repo.Fechar(id, idFuncionario);
}