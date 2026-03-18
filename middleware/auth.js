/**
 * Middleware d'authentification
 * Vérifie que l'utilisateur est connecté via la session
 * Laisse passer les routes de login sans authentification
 */
function authMiddleware(req, res, next) {
  // Routes publiques (pas besoin d'authentification)
  const publicRoutes = [
    '/api/auth/login'
  ];

  const isPublicRoute = publicRoutes.some(route => req.path === route || req.originalUrl === route);

  if (isPublicRoute) {
    return next();
  }

  // Vérifier la session utilisateur
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      success: false,
      error: 'Non authentifié. Veuillez vous connecter.'
    });
  }

  next();
}

module.exports = authMiddleware;
