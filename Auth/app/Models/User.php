<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Tymon\JWTAuth\Contracts\JWTSubject;

class User extends Authenticatable implements JWTSubject
{
    use HasFactory;

    protected $fillable = [
        'reg_no',
        'password',
        'role',
    ];

    protected $hidden = [
        'password',
    ];

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
        ];
    }

    // JWT: identifier claim
    public function getJWTIdentifier()
    {
        return $this->getKey();
    }

    // JWT: custom claims matching the Node.js token payload
    public function getJWTCustomClaims()
    {
        return [
            'regNo' => $this->reg_no,
            'role' => $this->role,
        ];
    }

    // Relationships
    public function chats()
    {
        return $this->hasMany(Chat::class);
    }

    public function uploadedFiles()
    {
        return $this->hasMany(UploadedFile::class);
    }
}
