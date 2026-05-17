using API.Models;
using API.DTOs;
using API.Repositories;

namespace API.Services;

public class VendaService(VendaRepository repo)
{
    public int Registrar(Venda v, List<ItemVendaRequest> itens) => repo.Insert(v, itens);
    public List<Venda> Listar(DateTime? de, DateTime? ate) => repo.GetAll(de, ate);
    public Venda? BuscarPorId(int id) => repo.GetById(id);
}