<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class RequestLogger
{
    public function handle(Request $request, Closure $next)
    {
        Log::info("{$request->method()} {$request->fullUrl()} - {$request->ip()}");

        return $next($request);
    }
}
