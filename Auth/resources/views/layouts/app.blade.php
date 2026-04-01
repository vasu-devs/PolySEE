<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>@yield('title', 'Auth Service - Laravel MVC')</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; }
        .container { max-width: 800px; margin: 0 auto; padding: 2rem; }
        h1 { color: #38bdf8; margin-bottom: 0.5rem; }
        h2 { color: #94a3b8; font-weight: 400; margin-bottom: 2rem; }
        .card { background: #1e293b; border-radius: 12px; padding: 1.5rem; margin-bottom: 1rem; border: 1px solid #334155; }
        .badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
        .badge-get { background: #065f46; color: #6ee7b7; }
        .badge-post { background: #7c2d12; color: #fdba74; }
        code { background: #334155; padding: 0.15rem 0.4rem; border-radius: 4px; font-size: 0.9rem; }
        .nav { display: flex; gap: 1rem; margin-bottom: 2rem; }
        .nav a { color: #38bdf8; text-decoration: none; }
        .nav a:hover { text-decoration: underline; }
        input { width: 100%; padding: 0.75rem; margin-bottom: 1rem; border: 1px solid #334155; border-radius: 8px; background: #0f172a; color: #e2e8f0; font-size: 1rem; }
        button { padding: 0.75rem 2rem; background: #2563eb; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 1rem; }
        button:hover { background: #1d4ed8; }
        .result { margin-top: 1rem; padding: 1rem; background: #0f172a; border-radius: 8px; font-family: monospace; white-space: pre-wrap; word-break: break-all; }
        .footer { text-align: center; margin-top: 3rem; color: #475569; font-size: 0.85rem; }
    </style>
</head>
<body>
    <div class="container">
        <nav class="nav">
            <a href="/">Home</a>
            <a href="/login-page">Login Demo</a>
        </nav>

        @yield('content')

        <div class="footer">
            <p>Auth Service &mdash; Built with Laravel {{ app()->version() }} (MVC Architecture)</p>
        </div>
    </div>
</body>
</html>
