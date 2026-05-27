using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using StackExchange.Redis;
using API.Models;

namespace API.Services;

public class TokenService(IConfiguration config, IConnectionMultiplexer redis)
{
    private readonly IDatabase _db = redis.GetDatabase();
    private readonly string _key = config["Jwt:Key"]!;
    private readonly int _ttl = int.Parse(config["Jwt:TtlSeconds"] ?? "28800");

    public string GerarToken(Usuario usuario)
    {
        // Admin tem sessão ilimitada (100 anos), funcionários 5 minutos
        var ttl = usuario.Cargo.ToLower() == "gerente"
            ? int.MaxValue                  // Sessão "ilimitada" (máximo possível)
            : 5 * 60;                       // 5 minutos

        var claims = new[]
        {
        new Claim(ClaimTypes.NameIdentifier, usuario.Id.ToString()),
        new Claim(ClaimTypes.Name,           usuario.Login),
        new Claim(ClaimTypes.Role,           usuario.Cargo),
        new Claim("funcionario_id",          usuario.IdFuncionario.ToString()),
        new Claim("nome",                    usuario.NomeFuncionario)
    };

        var creds = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_key)),
            SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            claims: claims,
            expires: DateTime.UtcNow.AddSeconds(ttl),
            signingCredentials: creds);

        var tokenStr = new JwtSecurityTokenHandler().WriteToken(token);

        _db.StringSet($"session:{usuario.Id}", tokenStr, TimeSpan.FromSeconds(ttl));

        return tokenStr;
    }

    public void RevogarToken(int usuarioId)
        => _db.KeyDelete($"session:{usuarioId}");
}