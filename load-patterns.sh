#!/bin/bash
set -euo pipefail

mkdir -p patterns
cd patterns
options="--no-clobber"
wget ${options} https://conwaylife.com/patterns/gosperglidergun.rle
wget ${options} https://conwaylife.com/patterns/greyship.rle
wget ${options} https://conwaylife.com/patterns/otcametapixel.rle