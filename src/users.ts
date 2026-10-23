
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyHandler,
  APIGatewayProxyResult,
} from "aws-lambda";

interface User {
  id: string;
  name: string;
  email: string;
}

const users: User[] = [
  {
    id: "1",
    name: "Sunil",
    email: "sunil@example.com",
  },
  {
    id: "2",
    name: "Vinay",
    email: "vinay@example.com",
  },
];

const handleRequest = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> =>
  {
    console.log("Invoked lambda with event: ", JSON.stringify(event, null, 2));
    
    const method = event.httpMethod;
    const id = event.pathParameters?.id;

    try {
      // GET /users
      if (method === "GET" && !id) {
        return {
          statusCode: 200,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(users),
        };
      }

      // GET /users/{id}
      if (method === "GET" && id) {
        const user = users.find(
          (item) => item.id === id,
        );

        return user
          ? {
              statusCode: 200,
              body: JSON.stringify(user),
            }
          : {
            statusCode: 404,
            body: JSON.stringify({
              message: "User not found",
            }),
          };
      }

      // POST /users
      if (method === "POST") {
        const body = JSON.parse(event.body ?? "{}");

        if (!body.name || !body.email) {
          return {
            statusCode: 400,
            body: JSON.stringify({
              message: "Name and email are required",
            }),
          };
        }

        const newUser: User = {
          id: String(Date.now()),
          name: body.name,
          email: body.email,
        };

        users.push(newUser);

        return {
          statusCode: 201,
          body: JSON.stringify(newUser),
        };
      }

      // PUT /users/{id}
      if (method === "PUT" && id) {
        const user = users.find(
          (item) => item.id === id,
        );

        if (!user) {
          return {
            statusCode: 404,
            body: JSON.stringify({
              message: "User not found",
            }),
          };
        }

        const body = JSON.parse(event.body ?? "{}");

        if (body.name) user.name = body.name;
        if (body.email) user.email = body.email;

        return {
          statusCode: 200,
          body: JSON.stringify(user),
        };
      }

      // DELETE /users/{id}
      if (method === "DELETE" && id) {
        const index = users.findIndex(
          (item) => item.id === id,
        );

        if (index === -1) {
          return {
            statusCode: 404,
            body: JSON.stringify({
              message: "User not found",
            }),
          };
        }

        const deletedUser = users.splice(index, 1)[0];

        return {
          statusCode: 200,
          body: JSON.stringify({
            message: "User deleted",
            user: deletedUser,
          }),
        };
      }

      return {
        statusCode: 405,
        body: JSON.stringify({
          message: "Method not supported for this route",
        }),
      };
    } catch {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Invalid request body",
        }),
      };
    }
  };

export const handler: APIGatewayProxyHandler =
  async (event) => {
    const response = await handleRequest(event);

    return {
      ...response,
      headers: {
        ...response.headers,
        "Access-Control-Allow-Origin": "*",
      },
    };
  };
