namespace API.DTOs;

public record LoginRequest(string Login, string Senha);
public record LoginResponse(string Token, string Nome, string Cargo);