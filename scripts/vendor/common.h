/* Standalone compatibility header for SDLPAL's GPL-3.0 yj1.c asset decoder.
 * This helper is only used by the offline extraction script, never shipped in JS. */
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
typedef int INT;
typedef const void *LPCVOID;
typedef void *LPVOID;
#if __BYTE_ORDER__ == __ORDER_BIG_ENDIAN__
#define SDL_SwapLE16(x) __builtin_bswap16(x)
#define SDL_SwapLE32(x) __builtin_bswap32(x)
#else
#define SDL_SwapLE16(x) (x)
#define SDL_SwapLE32(x) (x)
#endif
