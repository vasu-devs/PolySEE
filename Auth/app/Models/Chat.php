<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Chat extends Model
{
    protected $fillable = [
        'user_id',
        'query',
        'response',
        'success',
        'response_time_ms',
        'language',
        'category',
    ];

    protected function casts(): array
    {
        return [
            'success' => 'boolean',
            'response_time_ms' => 'integer',
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
