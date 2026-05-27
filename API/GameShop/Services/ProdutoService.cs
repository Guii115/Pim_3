using API.Models;
using API.Repositories;

namespace API.Services;

public class ProdutoService(ProdutoRepository repo)
{
    public List<Produto> Listar() => repo.GetAll();
    public Produto? BuscarPorId(int id) => repo.GetById(id);
    public List<Produto> EstoqueBaixo() => repo.GetEstoqueBaixo();
    public void Inserir(Produto p) => repo.Insert(p);
    public bool Atualizar(int id, Produto p) => repo.Update(id, p);
    public bool Deletar(int id) => repo.Delete(id);
    public string ProximoCodigo() => repo.GerarCodigoAutomatico();
}