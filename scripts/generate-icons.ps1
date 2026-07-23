param([string]$OutputDirectory = "public")

Add-Type -AssemblyName System.Drawing

function New-AppIcon([int]$Size, [string]$Path) {
  $bitmap = New-Object System.Drawing.Bitmap($Size, $Size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $scale = $Size / 512.0

  $background = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Rectangle(0, 0, $Size, $Size)),
    [System.Drawing.Color]::FromArgb(251, 249, 242),
    [System.Drawing.Color]::FromArgb(238, 243, 213),
    45.0
  )
  $graphics.FillRectangle($background, 0, 0, $Size, $Size)

  function New-RoundedPath([float]$x, [float]$y, [float]$width, [float]$height, [float]$radius) {
    $shape = New-Object System.Drawing.Drawing2D.GraphicsPath
    $diameter = $radius * 2
    $shape.AddArc($x, $y, $diameter, $diameter, 180, 90)
    $shape.AddArc($x + $width - $diameter, $y, $diameter, $diameter, 270, 90)
    $shape.AddArc($x + $width - $diameter, $y + $height - $diameter, $diameter, $diameter, 0, 90)
    $shape.AddArc($x, $y + $height - $diameter, $diameter, $diameter, 90, 90)
    $shape.CloseFigure()
    return $shape
  }

  $dark = [System.Drawing.Color]::FromArgb(23, 32, 26)
  $limeColor = [System.Drawing.Color]::FromArgb(189, 232, 41)
  $lime = New-Object System.Drawing.SolidBrush($limeColor)
  $darkBrush = New-Object System.Drawing.SolidBrush($dark)

  $orbitPen = New-Object System.Drawing.Pen($dark, [float](26*$scale))
  $orbitPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $orbitPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $graphics.DrawArc($orbitPen, [float](91*$scale), [float](91*$scale), [float](330*$scale), [float](330*$scale), 25, 310)
  $graphics.FillEllipse($lime, [float](389*$scale), [float](169*$scale), [float](34*$scale), [float](34*$scale))

  $bar = New-RoundedPath ([float](172*$scale)) ([float](245*$scale)) ([float](168*$scale)) ([float](22*$scale)) ([float](11*$scale))
  $graphics.FillPath($lime, $bar)
  foreach ($rect in @(
    @(136,197,45,118,20), @(194,216,32,80,14), @(286,216,32,80,14), @(331,197,45,118,20)
  )) {
    $shape = New-RoundedPath ([float]($rect[0]*$scale)) ([float]($rect[1]*$scale)) ([float]($rect[2]*$scale)) ([float]($rect[3]*$scale)) ([float]($rect[4]*$scale))
    $graphics.FillPath($darkBrush, $shape)
    $shape.Dispose()
  }

  $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bar.Dispose(); $orbitPen.Dispose()
  $darkBrush.Dispose(); $lime.Dispose(); $background.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
}

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
New-AppIcon 192 (Join-Path $OutputDirectory "icon-192.png")
New-AppIcon 512 (Join-Path $OutputDirectory "icon-512.png")
