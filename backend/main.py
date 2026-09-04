"""Phase 2 smoke test for the CascadeGuard backend.

Run with:
    python -m backend.main
"""

from backend.featherless_client import chat_completion


def main() -> None:
    response = chat_completion(
        [
            {
                "role": "system",
                "content": "Reply with concise JSON only.",
            },
            {
                "role": "user",
                "content": 'Return exactly {"status":"ok","service":"featherless"}.',
            },
        ]
    )
    message = response["choices"][0]["message"]["content"]
    print(message)


if __name__ == "__main__":
    main()