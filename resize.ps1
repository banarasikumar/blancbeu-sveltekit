param (
    [string]$sourcePath,
    [string]$destinationPath,
    [int]$width,
    [int]$height
)

Add-Type -AssemblyName System.Drawing
$image = [System.Drawing.Image]::FromFile($sourcePath)
$newImage = New-Object System.Drawing.Bitmap($width, $height)
$graphics = [System.Drawing.Graphics]::FromImage($newImage)
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
$graphics.DrawImage($image, 0, 0, $width, $height)
$newImage.Save($destinationPath, [System.Drawing.Imaging.ImageFormat]::Png)
$image.Dispose()
$newImage.Dispose()
$graphics.Dispose()
