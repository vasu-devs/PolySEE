@extends('layouts.app')

@section('title', 'Login - Auth Service')

@section('content')
    <h1>Login Demo</h1>
    <h2>Blade View demonstrating the "V" in MVC</h2>

    <div class="card">
        <form id="loginForm">
            <label style="display: block; margin-bottom: 0.25rem; color: #94a3b8;">Registration Number</label>
            <input type="text" id="regNo" placeholder="Enter registration number" required>

            <label style="display: block; margin-bottom: 0.25rem; color: #94a3b8;">Password</label>
            <input type="password" id="password" placeholder="Enter password" required>

            <button type="submit">Login</button>
        </form>

        <div id="result" class="result" style="display: none;"></div>
    </div>

    <div class="card">
        <h3 style="margin-bottom: 0.5rem; color: #f1f5f9;">How this works</h3>
        <p style="color: #94a3b8;">This Blade view posts to <code>POST /auth/login</code> via JavaScript fetch. The same endpoint serves both this Blade form and the React frontend. This demonstrates how Laravel's View layer can coexist with a separate SPA frontend.</p>
    </div>

    <script>
        document.getElementById('loginForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            const resultDiv = document.getElementById('result');
            resultDiv.style.display = 'block';
            resultDiv.textContent = 'Logging in...';

            try {
                const response = await fetch('/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        regNo: document.getElementById('regNo').value,
                        password: document.getElementById('password').value
                    })
                });

                const data = await response.json();

                if (response.ok) {
                    resultDiv.textContent = 'Login successful!\n\n' + JSON.stringify(data, null, 2);
                    resultDiv.style.color = '#6ee7b7';
                } else {
                    resultDiv.textContent = 'Login failed: ' + (data.error || 'Unknown error');
                    resultDiv.style.color = '#fca5a5';
                }
            } catch (err) {
                resultDiv.textContent = 'Network error: ' + err.message;
                resultDiv.style.color = '#fca5a5';
            }
        });
    </script>
@endsection
