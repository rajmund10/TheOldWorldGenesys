param(
	[Parameter(Mandatory = $true)]
	[string] $InputPath,

	[string] $OutputDirectory = "",

	[ValidateRange(1, 6)]
	[int] $Scale = 2
)

Add-Type -AssemblyName System.Drawing

$resolvedInput = (Resolve-Path -LiteralPath $InputPath).Path
$baseName = [System.IO.Path]::GetFileNameWithoutExtension($resolvedInput)

if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
	$OutputDirectory = Join-Path (Resolve-Path '.codex-temp').Path "specialization-crops\$baseName"
}

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

function Save-ScaledCrop {
	param(
		[System.Drawing.Bitmap] $Source,
		[System.Drawing.Rectangle] $Rectangle,
		[string] $OutputPath,
		[int] $OutputScale
	)

	$crop = $Source.Clone($Rectangle, $Source.PixelFormat)
	try {
		$scaled = [System.Drawing.Bitmap]::new($crop.Width * $OutputScale, $crop.Height * $OutputScale)
		try {
			$graphics = [System.Drawing.Graphics]::FromImage($scaled)
			try {
				$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
				$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
				$graphics.DrawImage($crop, 0, 0, $scaled.Width, $scaled.Height)
			}
			finally {
				$graphics.Dispose()
			}

			$scaled.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
		}
		finally {
			$scaled.Dispose()
		}
	}
	finally {
		$crop.Dispose()
	}
}

$source = [System.Drawing.Bitmap]::FromFile($resolvedInput)
try {
	# The source pages share one layout. Ratios keep the crop usable if a page is
	# exported at a different resolution. Each band includes two complete rows
	# and the full connector space around them.
	$left = [Math]::Floor($source.Width * 0.017)
	$top = [Math]::Floor($source.Height * 0.475)
	$width = [Math]::Min([Math]::Floor($source.Width * 0.967), $source.Width - $left)
	$rowStep = [Math]::Floor($source.Height * 0.0975)
	$bandHeight = [Math]::Floor($source.Height * 0.205)

	for ($row = 0; $row -lt 4; $row++) {
		$bandTop = $top + ($row * $rowStep)
		$height = [Math]::Min($bandHeight, $source.Height - $bandTop)
		$rectangle = [System.Drawing.Rectangle]::new($left, $bandTop, $width, $height)
		$outputPath = Join-Path $OutputDirectory ("rows-{0}-{1}-x{2}.png" -f ($row + 1), ($row + 2), $Scale)
		Save-ScaledCrop -Source $source -Rectangle $rectangle -OutputPath $outputPath -OutputScale $Scale
	}
}
finally {
	$source.Dispose()
}

Get-ChildItem -LiteralPath $OutputDirectory -Filter '*.png' | Select-Object FullName, Length
