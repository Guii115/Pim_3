using Npgsql;
using API.Models;

namespace API.Repositories;

public class CaixaRepository(NpgsqlDataSource ds)
{
    public Caixa? GetAberto(int idFuncionario = 0)
    {
        using var conn = ds.OpenConnection();
        string sql = """
            SELECT id, data_abertura, valor_inicial, status, id_funcionario
            FROM caixa WHERE status = 'aberto'
        """;

        if (idFuncionario > 0)
            sql += " AND id_funcionario = @id";

        sql += " ORDER BY data_abertura DESC LIMIT 1";

        using var cmd = new NpgsqlCommand(sql, conn);
        if (idFuncionario > 0)
            cmd.Parameters.AddWithValue("id", idFuncionario);

        using var r = cmd.ExecuteReader();
        if (!r.Read()) return null;

        var caixa = new Caixa
        {
            Id = r.GetInt32(0),
            DataAbertura = r.GetDateTime(1),
            ValorInicial = r.GetDecimal(2),
            Status = r.GetString(3),
            IdFuncionario = r.GetInt32(4)
        };
        r.Close();

        // 🌟 CORREÇÃO: Usamos um JOIN direto no banco! Adeus bug de Fuso Horário!
        const string sqlTotais = """
            SELECT
              COALESCE(SUM(CASE WHEN v.forma_pagamento='dinheiro' THEN v.total ELSE 0.0 END), 0.0),
              COALESCE(SUM(CASE WHEN v.forma_pagamento='pix'      THEN v.total ELSE 0.0 END), 0.0),
              COALESCE(SUM(CASE WHEN v.forma_pagamento='debito'   THEN v.total ELSE 0.0 END), 0.0),
              COALESCE(SUM(CASE WHEN v.forma_pagamento='credito'  THEN v.total ELSE 0.0 END), 0.0),
              COALESCE(SUM(v.total), 0.0)
            FROM venda v
            JOIN caixa c ON c.id = @idCaixa
            WHERE v.data_venda >= c.data_abertura
        """;

        using var cmdT = new NpgsqlCommand(sqlTotais, conn);
        cmdT.Parameters.AddWithValue("idCaixa", caixa.Id);
        using var rt = cmdT.ExecuteReader();

        if (rt.Read())
        {
            caixa.TotalDinheiro = rt.GetDecimal(0);
            caixa.TotalPix = rt.GetDecimal(1);
            caixa.TotalDebito = rt.GetDecimal(2);
            caixa.TotalCredito = rt.GetDecimal(3);
            caixa.TotalGeral = rt.GetDecimal(4);
        }

        return caixa;
    }

    public int Abrir(int idFuncionario, decimal valorInicial)
    {
        using var conn = ds.OpenConnection();
        const string sql = """
            INSERT INTO caixa (id_funcionario, valor_inicial, data_abertura, status)
            VALUES (@fid, @val, NOW(), 'aberto') RETURNING id
        """;
        using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("fid", idFuncionario);
        cmd.Parameters.AddWithValue("val", valorInicial);
        return (int)cmd.ExecuteScalar()!;
    }

    public Caixa? Fechar(int id, int idFuncionario)
    {
        using var conn = ds.OpenConnection();

        // 🌟 Mesma proteção no fechamento para garantir segurança máxima
        const string sqlTotais = """
            SELECT
              COALESCE(SUM(CASE WHEN forma_pagamento='dinheiro' THEN total ELSE 0.0 END), 0.0),
              COALESCE(SUM(CASE WHEN forma_pagamento='pix'      THEN total ELSE 0.0 END), 0.0),
              COALESCE(SUM(CASE WHEN forma_pagamento='debito'   THEN total ELSE 0.0 END), 0.0),
              COALESCE(SUM(CASE WHEN forma_pagamento='credito'  THEN total ELSE 0.0 END), 0.0),
              COALESCE(SUM(total), 0.0)
            FROM venda v
            JOIN caixa c ON c.id = @id
            WHERE v.data_venda >= c.data_abertura
        """;

        using var cmdT = new NpgsqlCommand(sqlTotais, conn);
        cmdT.Parameters.AddWithValue("id", id);
        using var r = cmdT.ExecuteReader();
        r.Read();
        var din = r.GetDecimal(0);
        var pix = r.GetDecimal(1);
        var deb = r.GetDecimal(2);
        var cre = r.GetDecimal(3);
        var tot = r.GetDecimal(4);
        r.Close();

        const string sqlF = """
            UPDATE caixa SET
              status = 'fechado', data_fechamento = NOW(),
              total_dinheiro=@din, total_pix=@pix,
              total_debito=@deb,   total_credito=@cre, total_geral=@tot
            WHERE id = @id AND status = 'aberto'
            RETURNING id, data_abertura, data_fechamento, valor_inicial,
                      total_dinheiro, total_pix, total_debito, total_credito, total_geral, status, id_funcionario
        """;
        using var cmdF = new NpgsqlCommand(sqlF, conn);
        cmdF.Parameters.AddWithValue("din", din);
        cmdF.Parameters.AddWithValue("pix", pix);
        cmdF.Parameters.AddWithValue("deb", deb);
        cmdF.Parameters.AddWithValue("cre", cre);
        cmdF.Parameters.AddWithValue("tot", tot);
        cmdF.Parameters.AddWithValue("id", id);

        using var rf = cmdF.ExecuteReader();
        if (!rf.Read()) return null;

        return new Caixa
        {
            Id = rf.GetInt32(0),
            DataAbertura = rf.GetDateTime(1),
            DataFechamento = rf.GetDateTime(2),
            ValorInicial = rf.GetDecimal(3),
            TotalDinheiro = rf.GetDecimal(4),
            TotalPix = rf.GetDecimal(5),
            TotalDebito = rf.GetDecimal(6),
            TotalCredito = rf.GetDecimal(7),
            TotalGeral = rf.GetDecimal(8),
            Status = rf.GetString(9),
            IdFuncionario = rf.GetInt32(10)
        };
    }
}