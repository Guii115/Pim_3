using Npgsql;
using API.Models;
using API.DTOs;

namespace API.Repositories;

public class VendaRepository(NpgsqlDataSource ds)
{
    public int Insert(Venda v, List<ItemVendaRequest> itens)
    {
        using var conn = ds.OpenConnection();
        using var tx = conn.BeginTransaction();

        // 1. Inserimos a venda com total 0 inicial
        const string sqlV = """
            INSERT INTO venda (total, desconto, forma_pagamento, id_cliente, id_usuario)
            VALUES (@total, @desc, @forma, @cli, @usr)
            RETURNING id
        """;
        using var cmdV = new NpgsqlCommand(sqlV, conn, tx);
        cmdV.Parameters.AddWithValue("total", 0m);
        cmdV.Parameters.AddWithValue("desc", v.Desconto);
        cmdV.Parameters.AddWithValue("forma", v.FormaPagamento);
        cmdV.Parameters.AddWithValue("cli", (object?)v.IdCliente ?? DBNull.Value);
        cmdV.Parameters.AddWithValue("usr", v.IdUsuario);

        var vendaId = (int)cmdV.ExecuteScalar()!;
        decimal totalCalculado = 0;

        foreach (var item in itens)
        {
            // Busca o preço real na tabela
            using var cmdP = new NpgsqlCommand("SELECT preco FROM produto WHERE id = @id", conn, tx);
            cmdP.Parameters.AddWithValue("id", item.IdProduto);
            var preco = (decimal)cmdP.ExecuteScalar()!;

            totalCalculado += preco * item.Quantidade;

            // Grava os itens
            const string sqlI = """
                INSERT INTO item_venda (id_venda, id_produto, quantidade, preco_unitario)
                VALUES (@vid, @pid, @qtd, @preco)
            """;
            using var cmdI = new NpgsqlCommand(sqlI, conn, tx);
            cmdI.Parameters.AddWithValue("vid", vendaId);
            cmdI.Parameters.AddWithValue("pid", item.IdProduto);
            cmdI.Parameters.AddWithValue("qtd", item.Quantidade);
            cmdI.Parameters.AddWithValue("preco", preco);
            cmdI.ExecuteNonQuery();

            // Baixa no estoque
            using var cmdE = new NpgsqlCommand(
                "UPDATE produto SET quantidade_estoque = quantidade_estoque - @qtd WHERE id = @id", conn, tx);
            cmdE.Parameters.AddWithValue("qtd", item.Quantidade);
            cmdE.Parameters.AddWithValue("id", item.IdProduto);
            cmdE.ExecuteNonQuery();
        }

        // 2. Atualiza a venda com o total verdadeiro e descontos aplicados
        totalCalculado = Math.Max(totalCalculado - v.Desconto, 0);

        using var cmdUpdate = new NpgsqlCommand("UPDATE venda SET total = @total WHERE id = @id", conn, tx);
        cmdUpdate.Parameters.AddWithValue("total", totalCalculado);
        cmdUpdate.Parameters.AddWithValue("id", vendaId);
        cmdUpdate.ExecuteNonQuery();

        tx.Commit();
        return vendaId;
    }

    public List<Venda> GetAll(DateTime? de = null, DateTime? ate = null)
    {
        var list = new List<Venda>();
        using var conn = ds.OpenConnection();
        var sql = """
            SELECT v.id, v.data_venda, v.total, v.desconto, v.forma_pagamento,
                   p.nome, v.id_cliente, v.id_usuario
            FROM venda v
            LEFT JOIN cliente c ON c.id = v.id_cliente
            LEFT JOIN pessoa  p ON p.id = c.id
            WHERE (@de IS NULL OR v.data_venda >= @de)
              AND (@ate IS NULL OR v.data_venda <= @ate)
            ORDER BY v.data_venda DESC
        """;

        using var cmd = new NpgsqlCommand(sql, conn);
        // CORREÇÃO AQUI: Tipagem estrita restaurada para o PostgreSQL não surtar com nulos (Erro 500)
        cmd.Parameters.Add(new NpgsqlParameter("de", NpgsqlTypes.NpgsqlDbType.Timestamp) { Value = (object?)de ?? DBNull.Value });
        cmd.Parameters.Add(new NpgsqlParameter("ate", NpgsqlTypes.NpgsqlDbType.Timestamp) { Value = (object?)ate ?? DBNull.Value });

        using var r = cmd.ExecuteReader();
        while (r.Read())
        {
            list.Add(new Venda
            {
                Id = r.GetInt32(0),
                DataVenda = r.GetDateTime(1),
                Total = r.GetDecimal(2),
                Desconto = r.GetDecimal(3),
                FormaPagamento = r.GetString(4),
                NomeCliente = r.IsDBNull(5) ? null : r.GetString(5),
                IdCliente = r.IsDBNull(6) ? null : r.GetInt32(6),
                IdUsuario = r.GetInt32(7),
                Itens = new List<ItemVenda>() // Inicia a lista vazia para evitar NullReferenceException
            });
        }
        r.Close();

        // 3. Popula a tabela de itens
        foreach (var venda in list)
        {
            const string sqlI = """
                SELECT pr.nome, iv.quantidade, iv.preco_unitario
                FROM item_venda iv 
                JOIN produto pr ON pr.id = iv.id_produto
                WHERE iv.id_venda = @vid
            """;
            using var cmdI = new NpgsqlCommand(sqlI, conn);
            cmdI.Parameters.AddWithValue("vid", venda.Id);
            using var ri = cmdI.ExecuteReader();

            while (ri.Read())
            {
                venda.Itens.Add(new ItemVenda
                {
                    NomeProduto = ri.GetString(0),
                    Quantidade = ri.GetInt32(1),
                    PrecoUnit = ri.GetDecimal(2)
                });
            }
        }

        return list;
    }

    public Venda? GetById(int id)
    {
        using var conn = ds.OpenConnection();
        const string sqlV = """
            SELECT v.id, v.data_venda, v.total, v.desconto, v.forma_pagamento,
                   p.nome, v.id_cliente, v.id_usuario
            FROM venda v
            LEFT JOIN cliente c ON c.id = v.id_cliente
            LEFT JOIN pessoa  p ON p.id = c.id
            WHERE v.id = @id
        """;
        using var cmdV = new NpgsqlCommand(sqlV, conn);
        cmdV.Parameters.AddWithValue("id", id);
        using var r = cmdV.ExecuteReader();
        if (!r.Read()) return null;

        var venda = new Venda
        {
            Id = r.GetInt32(0),
            DataVenda = r.GetDateTime(1),
            Total = r.GetDecimal(2),
            Desconto = r.GetDecimal(3),
            FormaPagamento = r.GetString(4),
            NomeCliente = r.IsDBNull(5) ? null : r.GetString(5),
            IdCliente = r.IsDBNull(6) ? null : r.GetInt32(6),
            IdUsuario = r.GetInt32(7),
            Itens = new List<ItemVenda>() // Proteção contra nulos
        };
        r.Close();

        const string sqlI = """
            SELECT iv.id_produto, pr.nome, iv.quantidade, iv.preco_unitario
            FROM item_venda iv JOIN produto pr ON pr.id = iv.id_produto
            WHERE iv.id_venda = @id
        """;
        using var cmdI = new NpgsqlCommand(sqlI, conn);
        cmdI.Parameters.AddWithValue("id", id);
        using var ri = cmdI.ExecuteReader();
        while (ri.Read())
            venda.Itens.Add(new ItemVenda
            {
                IdProduto = ri.GetInt32(0),
                NomeProduto = ri.GetString(1),
                Quantidade = ri.GetInt32(2),
                PrecoUnit = ri.GetDecimal(3),
                Subtotal = ri.GetInt32(2) * ri.GetDecimal(3)
            });

        return venda;
    }
}