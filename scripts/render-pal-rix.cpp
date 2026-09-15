// Offline renderer using the installed LGPL AdPlug library; does not execute PAL binaries.
#include <adplug/adplug.h>
#include <adplug/emuopl.h>
#include <cstdio>
#include <memory>
#include <vector>

int main(int argc, char **argv) {
  if (argc != 3) return 1;
  CEmuopl opl(44100, true, false);
  std::unique_ptr<CPlayer> player(CAdPlug::factory(argv[1], &opl));
  if (!player) return 2;
  FILE *out = fopen(argv[2], "wb");
  if (!out) return 3;
  long samples = 0;
  while (player->update()) {
    const int count = int(44100 / player->getrefresh());
    if (count <= 0 || (samples += count) > 44100 * 600) { fclose(out); return 4; }
    std::vector<short> buffer(count);
    opl.update(buffer.data(), count);
    fwrite(buffer.data(), sizeof(short), count, out);
  }
  fclose(out);
  return samples ? 0 : 5;
}
