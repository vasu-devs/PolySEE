<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Tymon\JWTAuth\Facades\JWTAuth;
use Tymon\JWTAuth\Exceptions\JWTException;
use Tymon\JWTAuth\Exceptions\TokenExpiredException;
use Tymon\JWTAuth\Exceptions\TokenInvalidException;

class JwtAuthMiddleware
{
    public function handle(Request $request, Closure $next, string ...$roles)
    {
        $authHeader = $request->header('Authorization');
        if (!$authHeader) {
            return response()->json(['error' => 'no token'], 401);
        }

        try {
            $user = JWTAuth::parseToken()->authenticate();

            if (!$user) {
                return response()->json(['error' => 'invalid token'], 401);
            }

            // Check role if roles are specified
            if (!empty($roles) && !in_array($user->role, $roles)) {
                return response()->json(['error' => 'forbidden'], 403);
            }

            // Attach user to request (like Node.js req.user)
            $request->merge(['auth_user' => $user]);

        } catch (TokenExpiredException $e) {
            return response()->json(['error' => 'invalid token'], 401);
        } catch (TokenInvalidException $e) {
            return response()->json(['error' => 'invalid token'], 401);
        } catch (JWTException $e) {
            return response()->json(['error' => 'invalid token'], 401);
        }

        return $next($request);
    }
}
