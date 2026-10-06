import jwt from "jsonwebtoken";

export function authenticate(request, response, next) {
  const authorization = request.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return response.status(401).json({
      success: false,
      message: "Authentication token is required."
    });
  }

  try {
    const token = authorization.slice(7);

    request.user = jwt.verify(
      token,
      process.env.JWT_ACCESS_SECRET
    );

    next();
  } catch {
    response.status(401).json({
      success: false,
      message: "Your session is invalid or expired."
    });
  }
}

export function allowRoles(...roles) {
  return (request, response, next) => {
    if (!roles.includes(request.user.role)) {
      return response.status(403).json({
        success: false,
        message: "You do not have permission for this action."
      });
    }

    next();
  };
}