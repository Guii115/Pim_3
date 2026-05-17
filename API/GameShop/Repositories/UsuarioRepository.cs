using Npgsql;
using API.Models;

namespace API.Repositories;

public class UsuarioRepository(NpgsqlDataSource ds)
{
    public Usuario? GetByLogin(string login)
    {
        using var conn = ds.OpenConnection();
        const string sql = """
            SELECT u.id, u.login, u.senha_hash, u.ativo, u.id_funcionario,
                   p.nome, f.cargo
            FROM usuario u
            JOIN funcionario f ON f.id = u.id_funcionario
            JOIN pessoa p      ON p.id = f.id
            WHERE u.login = @login AND u.ativo = true
        """;
        using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("login", login);
        using var r = cmd.ExecuteReader();
        if (!r.Read()) return null;
        return new Usuario
        {
            Id = r.GetInt32(0),
            Login = r.GetString(1),
            SenhaHash = r.GetString(2),
            Ativo = r.GetBoolean(3),
            IdFuncionario = r.GetInt32(4),
            NomeFuncionario = r.GetString(5),
            Cargo = r.GetString(6)
        };
    }
}