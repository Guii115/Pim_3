using System.Text;
using API.Repositories;
using API.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.IdentityModel.Tokens;
using Npgsql;
using StackExchange.Redis; // Importante para o IConnectionMultiplexer

namespace API;

public class Program
{
    public static void Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);

        // PostgreSQL
        builder.Services.AddSingleton<NpgsqlDataSource>(_ =>
            NpgsqlDataSource.Create(
                builder.Configuration.GetConnectionString("DefaultConnection")!));

        // 1. Redis para o IDistributedCache (Usado no AuthController e validação nativa)
        builder.Services.AddStackExchangeRedisCache(opt =>
        {
            opt.Configuration = builder.Configuration["Redis:Connection"]!;
            opt.InstanceName = "GameShop:";
        });

        // 2. CORREÇÃO DO ERRO: Mantém o IConnectionMultiplexer ativo para o TokenService não quebrar!
        builder.Services.AddSingleton<IConnectionMultiplexer>(_ =>
            ConnectionMultiplexer.Connect(builder.Configuration["Redis:Connection"]!));

        // JWT integrado diretamente com o Redis
        var jwtKey = builder.Configuration["Jwt:Key"]!;
        builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(opt =>
            {
                opt.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
                    ValidateIssuer = false,
                    ValidateAudience = false
                };

                // Validador nativo de sessão
                opt.Events = new JwtBearerEvents
                {
                    OnTokenValidated = async context =>
                    {
                        var cache = context.HttpContext.RequestServices.GetRequiredService<IDistributedCache>();
                        var token = context.Request.Headers["Authorization"].ToString().Replace("Bearer ", "");

                        var sessaoAtiva = await cache.GetStringAsync(token);

                        if (string.IsNullOrWhiteSpace(sessaoAtiva))
                        {
                            context.Fail("Sessão expirada no Redis.");
                        }
                        else
                        {
                            await cache.RefreshAsync(token);
                        }
                    }
                };
            });

        // CORS
        builder.Services.AddCors(opt =>
            opt.AddDefaultPolicy(p =>
                p.AllowAnyOrigin()
                 .AllowAnyMethod()
                 .AllowAnyHeader()));

        // Injeções de dependência normais do seu projeto
        builder.Services.AddScoped<UsuarioRepository>();
        builder.Services.AddScoped<ProdutoRepository>();
        builder.Services.AddScoped<ClienteRepository>();
        builder.Services.AddScoped<VendaRepository>();
        builder.Services.AddScoped<CaixaRepository>();

        builder.Services.AddScoped<TokenService>();
        builder.Services.AddScoped<ProdutoService>();
        builder.Services.AddScoped<ClienteService>();
        builder.Services.AddScoped<VendaService>();
        builder.Services.AddScoped<CaixaService>();

        builder.Services.AddControllers();
        builder.Services.AddEndpointsApiExplorer();
        builder.Services.AddSwaggerGen();

        var app = builder.Build();

        app.UseSwagger();
        app.UseSwaggerUI();
        app.UseCors();

        app.UseAuthentication();
        app.UseAuthorization();

        app.MapControllers();
        app.Run();
    }
}