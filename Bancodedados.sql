DROP TABLE IF EXISTS item_venda   CASCADE;
DROP TABLE IF EXISTS item_compra  CASCADE;
DROP TABLE IF EXISTS venda        CASCADE;
DROP TABLE IF EXISTS compra       CASCADE;
DROP TABLE IF EXISTS caixa        CASCADE;
DROP TABLE IF EXISTS produto      CASCADE;
DROP TABLE IF EXISTS categoria    CASCADE;
DROP TABLE IF EXISTS fornecedor   CASCADE;
DROP TABLE IF EXISTS usuario      CASCADE;
DROP TABLE IF EXISTS funcionario  CASCADE;
DROP TABLE IF EXISTS cliente      CASCADE;
DROP TABLE IF EXISTS pessoa       CASCADE;
DROP TABLE IF EXISTS parametros   CASCADE;

CREATE TABLE pessoa (
    id            SERIAL PRIMARY KEY,
    nome          VARCHAR(150) NOT NULL,
    cpf_cnpj      VARCHAR(18)  UNIQUE,
    telefone      VARCHAR(20),
    email         VARCHAR(100),
    data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE cliente (
    id                INT PRIMARY KEY REFERENCES pessoa(id) ON DELETE CASCADE,
    fidelidade_pontos INT DEFAULT 0
);

CREATE TABLE funcionario (
    id            INT PRIMARY KEY REFERENCES pessoa(id) ON DELETE CASCADE,
    cargo         VARCHAR(50)   NOT NULL,
    salario       DECIMAL(10,2) NOT NULL,
    data_admissao DATE          NOT NULL
);

CREATE TABLE usuario (
    id             SERIAL PRIMARY KEY,
    login          VARCHAR(50)  NOT NULL UNIQUE,
    senha_hash     VARCHAR(255) NOT NULL,
    ativo          BOOLEAN      DEFAULT TRUE,
    id_funcionario INT NOT NULL REFERENCES funcionario(id) ON DELETE CASCADE
);

CREATE TABLE categoria (
    id   SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL
);

CREATE TABLE produto (
    id                 SERIAL PRIMARY KEY,
    codigo_fiscal      VARCHAR(50),
    nome               VARCHAR(150)  NOT NULL,
    plataforma         VARCHAR(50),
    preco              DECIMAL(10,2) NOT NULL,
    quantidade_estoque INT           NOT NULL DEFAULT 0,
    estoque_minimo     INT           NOT NULL DEFAULT 5,
    foto_url           TEXT,
    id_categoria       INT REFERENCES categoria(id)
);

CREATE TABLE venda (
    id              SERIAL PRIMARY KEY,
    data_venda      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    total           DECIMAL(10,2) NOT NULL,
    desconto        DECIMAL(10,2) DEFAULT 0,
    forma_pagamento VARCHAR(50),
    id_cliente      INT REFERENCES cliente(id),
    id_usuario      INT NOT NULL REFERENCES usuario(id)
);

CREATE TABLE item_venda (
    id_venda       INT           NOT NULL REFERENCES venda(id) ON DELETE CASCADE,
    id_produto     INT           NOT NULL REFERENCES produto(id),
    quantidade     INT           NOT NULL,
    preco_unitario DECIMAL(10,2) NOT NULL,
    PRIMARY KEY (id_venda, id_produto)
);

CREATE TABLE caixa (
    id              SERIAL PRIMARY KEY,
    id_funcionario  INT           NOT NULL REFERENCES funcionario(id),
    data_abertura   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    data_fechamento TIMESTAMP,
    valor_inicial   DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_dinheiro  DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_pix       DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_debito    DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_credito   DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_geral     DECIMAL(10,2) NOT NULL DEFAULT 0,
    status          VARCHAR(20)   NOT NULL DEFAULT 'aberto'
);

CREATE TABLE parametros (
    id        SERIAL PRIMARY KEY,
    chave     VARCHAR(50)  NOT NULL UNIQUE,
    valor     VARCHAR(255) NOT NULL,
    descricao TEXT
);

-- Índices
CREATE INDEX idx_produto_categoria  ON produto(id_categoria);
CREATE INDEX idx_venda_cliente      ON venda(id_cliente);
CREATE INDEX idx_venda_usuario      ON venda(id_usuario);
CREATE INDEX idx_venda_data         ON venda(data_venda);
CREATE INDEX idx_item_venda_produto ON item_venda(id_produto);

-- Dados iniciais básicos para teste
INSERT INTO categoria (nome) VALUES
  ('Jogos Mídia Física'),
  ('Acessórios'),
  ('Consoles');

INSERT INTO pessoa (nome, cpf_cnpj, email)
  VALUES ('Administrador', '00000000000', 'admin@gameshop.com');

INSERT INTO funcionario (id, cargo, salario, data_admissao)
  VALUES (1, 'Gerente', 4500.00, '2026-01-10');

INSERT INTO usuario (login, senha_hash, id_funcionario)
  VALUES ('admin', '$2a$11$yVk4seU4yk2Ujaxy8jistOqetqsUQluCAD1SeO.XyDkjCsIClsQQS', 1);

INSERT INTO parametros (chave, valor, descricao) VALUES
  ('nome_loja',      'GameShop', 'Nome exibido no sistema'),
  ('estoque_alerta', '5',        'Qtd mínima para alerta de estoque baixo'),
  ('sessao_ttl',     '28800',    'Tempo de sessão em segundos (8h)');

INSERT INTO caixa (id_funcionario, valor_inicial, data_abertura, status)
VALUES (1, 150.00, NOW(), 'aberto'::text);