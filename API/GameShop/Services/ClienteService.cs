using API.Models;
using API.Repositories;

namespace API.Services;

public class ClienteService(ClienteRepository repo)
{
    public List<Cliente> Listar() => repo.GetAll();
    public Cliente? BuscarPorId(int id) => repo.GetById(id);
    public Cliente? BuscarPorCpf(string cpf) => repo.GetByCpf(cpf);
    public void Inserir(Cliente c) => repo.Insert(c);
    public bool Atualizar(int id, Cliente c) => repo.Update(id, c);
    public bool Excluir(int id) => repo.Delete(id);
}