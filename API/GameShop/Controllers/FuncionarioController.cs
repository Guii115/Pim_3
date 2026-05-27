using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Npgsql;

namespace API.Controllers;

[ApiController]
[Route("api/funcionario")]
[Authorize(Roles = "Gerente,gerente")]
public class FuncionarioController(NpgsqlDataSource ds) : ControllerBase
{
    [HttpPost]
    public IActionResult Cadastrar([FromBody] CadastroFuncionarioRequest req)
    {
        using var conn = ds.OpenConnection();
        using var trans = conn.BeginTransaction();

        try
        {
            // 1. Insere na tabela 'pessoa'
            const string sqlPessoa = @"
                INSERT INTO pessoa (nome, cpf_cnpj, telefone, email) 
                VALUES (@nome, @cpf, @tel, @email) RETURNING id;";

            using var cmdPessoa = new NpgsqlCommand(sqlPessoa, conn, trans);
            cmdPessoa.Parameters.AddWithValue("nome", req.Nome);
            cmdPessoa.Parameters.AddWithValue("cpf", req.CpfCnpj);
            cmdPessoa.Parameters.AddWithValue("tel", (object?)req.Telefone ?? DBNull.Value);
            cmdPessoa.Parameters.AddWithValue("email", (object?)req.Email ?? DBNull.Value);

            int idPessoa = (int)cmdPessoa.ExecuteScalar()!;

            // 2. Insere na tabela 'funcionario'
            const string sqlFunc = @"
                INSERT INTO funcionario (id, cargo, salario, data_admissao) 
                VALUES (@id, @cargo, @salario, @data);";

            using var cmdFunc = new NpgsqlCommand(sqlFunc, conn, trans);
            cmdFunc.Parameters.AddWithValue("id", idPessoa);
            cmdFunc.Parameters.AddWithValue("cargo", req.Cargo);
            cmdFunc.Parameters.AddWithValue("salario", req.Salario);
            cmdFunc.Parameters.AddWithValue("data", DateTime.Today);
            cmdFunc.ExecuteNonQuery();

            // 3. Gera o Hash da senha com BCrypt e insere na tabela 'usuario'
            string senhaHash = BCrypt.Net.BCrypt.HashPassword(req.Senha);

            const string sqlUsuario = @"
                INSERT INTO usuario (login, senha_hash, id_funcionario, ativo) 
                VALUES (@login, @hash, @idFunc, true);";

            using var cmdUser = new NpgsqlCommand(sqlUsuario, conn, trans);
            cmdUser.Parameters.AddWithValue("login", req.Login);
            cmdUser.Parameters.AddWithValue("hash", senhaHash);
            cmdUser.Parameters.AddWithValue("idFunc", idPessoa);

            // 🌟 CORREÇÃO AQUI: O método correto é ExecuteNonQuery() aplicado ao cmdUser
            cmdUser.ExecuteNonQuery();

            trans.Commit();
            return Ok(new { mensagem = "Funcionário e credenciais de usuário criados com sucesso!" });
        }
        catch (Exception ex)
        {
            trans.Rollback();
            return StatusCode(500, new { mensagem = "Erro ao processar o cadastro.", detalhe = ex.Message });
        }
    }
}

public record CadastroFuncionarioRequest(
    string Nome,
    string CpfCnpj,
    string Telefone,
    string Email,
    string Cargo,
    decimal Salario,
    string Login,
    string Senha
);