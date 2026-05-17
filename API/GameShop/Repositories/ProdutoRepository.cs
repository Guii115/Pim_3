using Npgsql;
using API.Models;

namespace API.Repositories;

public class ProdutoRepository(NpgsqlDataSource ds)
{
    public List<Produto> GetAll()
    {
        var list = new List<Produto>();
        using var conn = ds.OpenConnection();
        const string sql = """
            SELECT p.id, p.codigo_fiscal, p.nome, p.plataforma, p.preco,
                   p.quantidade_estoque, p.id_categoria, c.nome,
                   p.estoque_minimo, p.foto_url
            FROM produto p
            LEFT JOIN categoria c ON c.id = p.id_categoria
            ORDER BY p.nome
        """;
        using var cmd = new NpgsqlCommand(sql, conn);
        using var r = cmd.ExecuteReader();
        while (r.Read())
            list.Add(Map(r));
        return list;
    }

    public Produto? GetById(int id)
    {
        using var conn = ds.OpenConnection();
        const string sql = """
            SELECT p.id, p.codigo_fiscal, p.nome, p.plataforma, p.preco,
                   p.quantidade_estoque, p.id_categoria, c.nome,
                   p.estoque_minimo, p.foto_url
            FROM produto p
            LEFT JOIN categoria c ON c.id = p.id_categoria
            WHERE p.id = @id
        """;
        using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("id", id);
        using var r = cmd.ExecuteReader();
        return r.Read() ? Map(r) : null;
    }

    public List<Produto> GetEstoqueBaixo()
    {
        var list = new List<Produto>();
        using var conn = ds.OpenConnection();
        const string sql = """
            SELECT p.id, p.codigo_fiscal, p.nome, p.plataforma, p.preco,
                   p.quantidade_estoque, p.id_categoria, c.nome,
                   p.estoque_minimo, p.foto_url
            FROM produto p
            LEFT JOIN categoria c ON c.id = p.id_categoria
            WHERE p.quantidade_estoque <= p.estoque_minimo
            ORDER BY p.quantidade_estoque
        """;
        using var cmd = new NpgsqlCommand(sql, conn);
        using var r = cmd.ExecuteReader();
        while (r.Read()) list.Add(Map(r));
        return list;
    }

    public void Insert(Produto p)
    {
        using var conn = ds.OpenConnection();
        const string sql = """
            INSERT INTO produto
              (codigo_fiscal, nome, plataforma, preco, quantidade_estoque,
               estoque_minimo, foto_url, id_categoria)
            VALUES
              (@cf, @nome, @plat, @preco, @qtd, @emin, @foto, @cat)
        """;
        using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("cf", (object?)p.CodigoFiscal ?? DBNull.Value);
        cmd.Parameters.AddWithValue("nome", p.Nome);
        cmd.Parameters.AddWithValue("plat", (object?)p.Plataforma ?? DBNull.Value);
        cmd.Parameters.AddWithValue("preco", p.Preco);
        cmd.Parameters.AddWithValue("qtd", p.QuantidadeEstoque);
        cmd.Parameters.AddWithValue("emin", p.EstoqueMinimo);
        cmd.Parameters.AddWithValue("foto", (object?)p.FotoUrl ?? DBNull.Value);
        cmd.Parameters.AddWithValue("cat", (object?)p.IdCategoria ?? DBNull.Value);
        cmd.ExecuteNonQuery();
    }

    public bool Update(int id, Produto p)
    {
        using var conn = ds.OpenConnection();
        const string sql = """
            UPDATE produto SET
              codigo_fiscal = @cf, nome = @nome, plataforma = @plat,
              preco = @preco, quantidade_estoque = @qtd, estoque_minimo = @emin,
              foto_url = @foto, id_categoria = @cat
            WHERE id = @id
        """;
        using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("id", id);
        cmd.Parameters.AddWithValue("cf", (object?)p.CodigoFiscal ?? DBNull.Value);
        cmd.Parameters.AddWithValue("nome", p.Nome);
        cmd.Parameters.AddWithValue("plat", (object?)p.Plataforma ?? DBNull.Value);
        cmd.Parameters.AddWithValue("preco", p.Preco);
        cmd.Parameters.AddWithValue("qtd", p.QuantidadeEstoque);
        cmd.Parameters.AddWithValue("emin", p.EstoqueMinimo);
        cmd.Parameters.AddWithValue("foto", (object?)p.FotoUrl ?? DBNull.Value);
        cmd.Parameters.AddWithValue("cat", (object?)p.IdCategoria ?? DBNull.Value);
        return cmd.ExecuteNonQuery() > 0;
    }

    public bool Delete(int id)
    {
        using var conn = ds.OpenConnection();
        using var tx = conn.BeginTransaction();

        using var cmdI = new NpgsqlCommand(
            "DELETE FROM item_venda WHERE id_produto = @id", conn, tx);
        cmdI.Parameters.AddWithValue("id", id);
        cmdI.ExecuteNonQuery();

        using var cmdP = new NpgsqlCommand(
            "DELETE FROM produto WHERE id = @id", conn, tx);
        cmdP.Parameters.AddWithValue("id", id);
        var rows = cmdP.ExecuteNonQuery();

        tx.Commit();
        return rows > 0;
    }

    public string GerarCodigoAutomatico()
    {
        using var conn = ds.OpenConnection();
        using var cmd = new NpgsqlCommand("SELECT COUNT(*) FROM produto", conn);
        var total = (long)cmd.ExecuteScalar()!;
        return $"PROD-{(total + 1):D4}";
    }

    private static Produto Map(NpgsqlDataReader r) => new()
    {
        Id = r.GetInt32(0),
        CodigoFiscal = r.IsDBNull(1) ? null : r.GetString(1),
        Nome = r.GetString(2),
        Plataforma = r.IsDBNull(3) ? null : r.GetString(3),
        Preco = r.GetDecimal(4),
        QuantidadeEstoque = r.GetInt32(5),
        IdCategoria = r.IsDBNull(6) ? null : r.GetInt32(6),
        NomeCategoria = r.IsDBNull(7) ? null : r.GetString(7),
        IdFornecedor = null,
        NomeFornecedor = null,
        EstoqueMinimo = r.GetInt32(8),
        FotoUrl = r.IsDBNull(9) ? null : r.GetString(9)
    };
}