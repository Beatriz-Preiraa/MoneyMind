import swaggerJsdoc from 'swagger-jsdoc';

// O Swagger gera uma pagina de documentacao interativa acessivel em /api/docs
// Qualquer pessoa do grupo consegue testar os endpoints direto pelo navegador
const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'MoneyMind API',
      version: '1.0.0',
      description: 'API do sistema de controle financeiro pessoal MoneyMind',
    },
    servers: [
      {
        url: 'http://localhost:3333',
        description: 'Servidor de desenvolvimento',
      },
    ],
    components: {
      securitySchemes: {
        // Bearer token — o usuario faz login, recebe um token JWT e envia em cada requisicao
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ BearerAuth: [] }],
  },
  // Escaneia os arquivos de rotas para pegar os comentarios de documentacao
  apis: ['./src/routes/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
