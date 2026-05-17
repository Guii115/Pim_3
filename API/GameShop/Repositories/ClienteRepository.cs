using Npgsql;
using API.Models;

namespace API.Repositories;

public class ClienteRepository(NpgsqlDataSource ds)
{
    public List<Cliente> GetAll()
    {
        var list = new List<Cliente>();
        using var conn = ds.OpenConnection();
        const string sql = """
            SELECT c.id, p.nome, p.cpf_cnpj, p.telefone, p.email
            FROM cliente c JOIN pessoa p ON p.id = c.id
            ORDER BY p.nome
        """;
        using var cmd = new NpgsqlCommand(sql, conn);
        using var r = cmd.ExecuteReader();
        while (r.Read()) list.Add(Map(r));
        return list;
    }

    public Cliente? GetById(int id)
    {
        using var conn = ds.OpenConnection();
        const string sql = """
            SELECT c.id, p.nome, p.cpf_cnpj, p.telefone, p.email
            FROM cliente c JOIN pessoa p ON p.id = c.id WHERE c.id = @id
        """;
        using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("id", id);
        using var r = cmd.ExecuteReader();
        return r.Read() ? Map(r) : null;
    }

    public Cliente? GetByCpf(string cpf)
    {
        using var conn = ds.OpenConnection();
        const string sql = """
            SELECT c.id, p.nome, p.cpf_cnpj, p.telefone, p.email
            FROM cliente c JOIN pessoa p ON p.id = c.id WHERE p.cpf_cnpj = @cpf
        """;
        using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("cpf", cpf);
        using var r = cmd.ExecuteReader();
        return r.Read() ? Map(r) : null;
    }

    public void Insert(Cliente c)
    {
        using var conn = ds.OpenConnection();
        using var tx = conn.BeginTransaction();
        const string sqlP = """
            INSERT INTO pessoa (nome, cpf_cnpj, telefone, email)
            VALUES (@nome, @cpf, @tel, @email)
            RETURNING id
        """;
        using var cmdP = new NpgsqlCommand(sqlP, conn, tx);
        cmdP.Parameters.AddWithValue("nome", c.Nome);
        cmdP.Parameters.AddWithValue("cpf", (object?)c.CpfCnpj ?? DBNull.Value);
        cmdP.Parameters.AddWithValue("tel", (object?)c.Telefone ?? DBNull.Value);
        cmdP.Parameters.AddWithValue("email", (object?)c.Email ?? DBNull.Value);
        var pessoaId = (int)cmdP.ExecuteScalar()!;

        const string sqlC = "INSERT INTO cliente (id) VALUES (@id)";
        using var cmdC = new NpgsqlCommand(sqlC, conn, tx);
        cmdC.Parameters.AddWithValue("id", pessoaId);
        cmdC.ExecuteNonQuery();
        tx.Commit();
    }

    public bool Update(int id, Cliente c)
    {
        using var conn = ds.OpenConnection();
        const string sql = """
            UPDATE pessoa SET nome=@nome, telefone=@tel, email=@email
            WHERE id = @id
        """;
        using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("id", id);
        cmd.Parameters.AddWithValue("nome", c.Nome);
        cmd.Parameters.AddWithValue("tel", (object?)c.Telefone ?? DBNull.Value);
        cmd.Parameters.AddWithValue("email", (object?)c.Email ?? DBNull.Value);
        return cmd.ExecuteNonQuery() > 0;
    }

    // Método Delete integrado usando Npgsql nativo
    public bool Delete(int id)
    {
        using var conn = ds.OpenConnection();
        const string sql = "DELETE FROM pessoa WHERE id = @id";
        using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("id", id);

        // Retorna true se o número de linhas afetadas no banco for maior que 0
        return cmd.ExecuteNonQuery() > 0;
    }

    private static Cliente Map(NpgsqlDataReader r) => new()
    {
        Id = r.GetInt32(0),
        Nome = r.GetString(1),
        CpfCnpj = r.IsDBNull(2) ? null : r.GetString(2),
        Telefone = r.IsDBNull(3) ? null : r.GetString(3),
        Email = r.IsDBNull(4) ? null : r.GetString(4)
    };
}