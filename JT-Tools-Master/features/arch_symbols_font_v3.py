#!/usr/bin/env python3
"""
Architectural Symbols Font Generator - v3
Improved accuracy matching reference blueprint symbols
"""

import fontforge
import math

UNITS_PER_EM = 1000
ASCENT = 800
DESCENT = 200
STROKE = 25

def create_font():
    font = fontforge.font()
    font.fontname = "ArchSymbols"
    font.familyname = "Architectural Symbols"
    font.fullname = "Architectural Symbols Regular"
    font.copyright = "Architectural drafting symbols"
    font.encoding = "UnicodeFull"
    font.em = UNITS_PER_EM
    font.ascent = ASCENT
    font.descent = DESCENT
    return font

def draw_line(pen, x1, y1, x2, y2, stroke_width):
    """Draw a line as a filled rectangle"""
    dx = x2 - x1
    dy = y2 - y1
    length = math.sqrt(dx*dx + dy*dy)
    if length == 0:
        return
    px = -dy / length * stroke_width / 2
    py = dx / length * stroke_width / 2
    
    pen.moveTo((x1 + px, y1 + py))
    pen.lineTo((x2 + px, y2 + py))
    pen.lineTo((x2 - px, y2 - py))
    pen.lineTo((x1 - px, y1 - py))
    pen.closePath()

def draw_arc_stroke(pen, cx, cy, radius, start_deg, end_deg, stroke_width):
    """Draw an arc as a stroked path"""
    segments = 32
    start_rad = math.radians(start_deg)
    end_rad = math.radians(end_deg)
    span = end_rad - start_rad
    
    outer_r = radius + stroke_width/2
    inner_r = radius - stroke_width/2
    
    outer_pts = []
    inner_pts = []
    
    for i in range(segments + 1):
        t = i / segments
        a = start_rad + span * t
        outer_pts.append((cx + outer_r * math.cos(a), cy + outer_r * math.sin(a)))
        inner_pts.append((cx + inner_r * math.cos(a), cy + inner_r * math.sin(a)))
    
    pen.moveTo(outer_pts[0])
    for p in outer_pts[1:]:
        pen.lineTo(p)
    for p in reversed(inner_pts):
        pen.lineTo(p)
    pen.closePath()

def draw_circle_stroke(pen, cx, cy, radius, stroke_width):
    """Draw a circle outline"""
    draw_arc_stroke(pen, cx, cy, radius, 0, 360, stroke_width)

def draw_oval_stroke(pen, cx, cy, rx, ry, stroke_width):
    """Draw an oval outline"""
    segments = 48
    outer_pts = []
    inner_pts = []
    
    for i in range(segments):
        a = 2 * math.pi * i / segments
        outer_pts.append((cx + (rx + stroke_width/2) * math.cos(a), 
                         cy + (ry + stroke_width/2) * math.sin(a)))
        inner_pts.append((cx + (rx - stroke_width/2) * math.cos(a),
                         cy + (ry - stroke_width/2) * math.sin(a)))
    
    # Outer path
    pen.moveTo(outer_pts[0])
    for p in outer_pts[1:]:
        pen.lineTo(p)
    pen.closePath()
    
    # Inner path (reversed for hole)
    pen.moveTo(inner_pts[0])
    for p in reversed(inner_pts[1:]):
        pen.lineTo(p)
    pen.closePath()

def draw_rect_stroke(pen, x, y, w, h, stroke_width):
    """Draw a rectangle outline (hollow)"""
    s = stroke_width
    # Outer
    pen.moveTo((x, y))
    pen.lineTo((x + w, y))
    pen.lineTo((x + w, y + h))
    pen.lineTo((x, y + h))
    pen.closePath()
    # Inner (clockwise for hole)
    pen.moveTo((x + s, y + s))
    pen.lineTo((x + s, y + h - s))
    pen.lineTo((x + w - s, y + h - s))
    pen.lineTo((x + w - s, y + s))
    pen.closePath()

def draw_filled_rect(pen, x, y, w, h):
    """Draw a filled rectangle"""
    pen.moveTo((x, y))
    pen.lineTo((x + w, y))
    pen.lineTo((x + w, y + h))
    pen.lineTo((x, y + h))
    pen.closePath()

# =============================================================================
# ARCHITECTURAL - Matching reference image style
# =============================================================================

def draw_door(glyph):
    """Door with swing arc - 'd'"""
    pen = glyph.glyphPen()
    
    # Reference shows: two short wall segments, door at angle, quarter circle arc
    wall_top = 650
    wall_bottom = 150
    hinge_x = 120
    door_len = wall_top - wall_bottom
    
    # Wall segments (short thick lines)
    draw_filled_rect(pen, 50, wall_top, 80, 50)  # Top wall
    draw_filled_rect(pen, 50, wall_bottom - 50, 80, 50)  # Bottom wall
    
    # Door at ~45 degree angle
    angle = math.radians(45)
    end_x = hinge_x + door_len * math.sin(angle)
    end_y = wall_top - door_len * math.cos(angle)
    draw_line(pen, hinge_x, wall_top, end_x, end_y, STROKE)
    
    # Quarter circle swing arc
    draw_arc_stroke(pen, hinge_x, wall_top, door_len, -90, 0, STROKE * 0.6)
    
    glyph.width = 550

def draw_sliding_door(glyph):
    """Sliding door - 'D' - shows as parallel lines in wall break"""
    pen = glyph.glyphPen()
    
    y_center = 400
    wall_thick = 60
    
    # Wall segments
    draw_filled_rect(pen, 0, y_center - wall_thick/2, 80, wall_thick)
    draw_filled_rect(pen, 520, y_center - wall_thick/2, 80, wall_thick)
    
    # Two parallel door panels (like the reference)
    draw_line(pen, 100, y_center - 180, 100, y_center + 180, STROKE)
    draw_line(pen, 140, y_center - 180, 140, y_center + 180, STROKE)
    
    draw_line(pen, 460, y_center - 180, 460, y_center + 180, STROKE)
    draw_line(pen, 500, y_center - 180, 500, y_center + 180, STROKE)
    
    glyph.width = 600

def draw_bifold_door(glyph):
    """Bi-fold door - 'b' - zigzag lines"""
    pen = glyph.glyphPen()
    
    top = 650
    bottom = 150
    mid = (top + bottom) / 2
    
    # Wall segments
    draw_filled_rect(pen, 30, top, 60, 50)
    draw_filled_rect(pen, 30, bottom - 50, 60, 50)
    draw_filled_rect(pen, 510, top, 60, 50)
    draw_filled_rect(pen, 510, bottom - 50, 60, 50)
    
    # Left bi-fold
    draw_line(pen, 90, top, 180, mid, STROKE)
    draw_line(pen, 180, mid, 90, bottom, STROKE)
    
    # Right bi-fold
    draw_line(pen, 510, top, 420, mid, STROKE)
    draw_line(pen, 420, mid, 510, bottom, STROKE)
    
    glyph.width = 600

def draw_pocket_door(glyph):
    """Pocket door - 'p' - line sliding into wall"""
    pen = glyph.glyphPen()
    
    y = 400
    wall_thick = 60
    
    # Walls (with dashed section showing pocket)
    draw_filled_rect(pen, 0, y - wall_thick/2, 150, wall_thick)
    draw_filled_rect(pen, 400, y - wall_thick/2, 200, wall_thick)
    
    # Door panel line
    draw_line(pen, 30, y, 200, y, STROKE)
    
    # Dashed lines showing pocket (simplified as short segments)
    for i in range(3):
        x = 50 + i * 35
        draw_line(pen, x, y - wall_thick/2 + 10, x + 20, y - wall_thick/2 + 10, STROKE * 0.5)
        draw_line(pen, x, y + wall_thick/2 - 10, x + 20, y + wall_thick/2 - 10, STROKE * 0.5)
    
    glyph.width = 600

def draw_window(glyph):
    """Window - 'w' - double line in wall"""
    pen = glyph.glyphPen()
    
    y = 400
    wall_thick = 60
    
    # Wall segments
    draw_filled_rect(pen, 0, y - wall_thick/2, 100, wall_thick)
    draw_filled_rect(pen, 500, y - wall_thick/2, 100, wall_thick)
    
    # Three parallel lines (glass representation)
    draw_line(pen, 100, y - 20, 500, y - 20, STROKE * 0.7)
    draw_line(pen, 100, y, 500, y, STROKE * 0.7)
    draw_line(pen, 100, y + 20, 500, y + 20, STROKE * 0.7)
    
    glyph.width = 600

def draw_french_door(glyph):
    """French door - 'F' - two doors with swings"""
    pen = glyph.glyphPen()
    
    top = 650
    bottom = 150
    mid_x = 300
    door_len = (top - bottom)
    
    # Wall segments
    draw_filled_rect(pen, 30, top, 60, 50)
    draw_filled_rect(pen, 30, bottom - 50, 60, 50)
    draw_filled_rect(pen, 510, top, 60, 50)
    draw_filled_rect(pen, 510, bottom - 50, 60, 50)
    
    # Left door
    angle = math.radians(30)
    draw_line(pen, 90, top, 90 + door_len * 0.4 * math.sin(angle), 
              top - door_len * 0.4 * math.cos(angle), STROKE)
    draw_arc_stroke(pen, 90, top, door_len * 0.4, -90, -60, STROKE * 0.5)
    
    # Right door
    draw_line(pen, 510, top, 510 - door_len * 0.4 * math.sin(angle),
              top - door_len * 0.4 * math.cos(angle), STROKE)
    draw_arc_stroke(pen, 510, top, door_len * 0.4, -90, -120, STROKE * 0.5)
    
    glyph.width = 600

# =============================================================================
# ELECTRICAL - Matching reference image
# =============================================================================

def draw_duplex_outlet(glyph):
    """Duplex outlet - 'o' - circle with line through and wall line"""
    pen = glyph.glyphPen()
    
    cx, cy = 250, 400
    r = 100
    
    draw_circle_stroke(pen, cx, cy, r, STROKE)
    draw_line(pen, cx - r - 30, cy, cx + r + 30, cy, STROKE)
    # Wall connection
    draw_line(pen, cx + r + 30, cy, 500, cy, STROKE)
    
    glyph.width = 550

def draw_switched_outlet(glyph):
    """Switched outlet - 'O' - circle with half filled"""
    pen = glyph.glyphPen()
    
    cx, cy = 250, 400
    r = 100
    
    draw_circle_stroke(pen, cx, cy, r, STROKE)
    draw_line(pen, cx - r - 30, cy, cx + r + 30, cy, STROKE)
    
    # Fill top half
    segments = 24
    pen.moveTo((cx - r + STROKE, cy))
    for i in range(segments + 1):
        a = math.pi * i / segments
        pen.lineTo((cx + (r - STROKE) * math.cos(a), cy + (r - STROKE) * math.sin(a)))
    pen.closePath()
    
    glyph.width = 550

def draw_tv_outlet(glyph):
    """TV outlet - 'v' - circle with TV text"""
    pen = glyph.glyphPen()
    
    cx, cy = 250, 400
    r = 100
    
    draw_circle_stroke(pen, cx, cy, r, STROKE)
    draw_line(pen, cx - r - 30, cy, cx + r + 30, cy, STROKE)
    
    # "TV" text - simplified
    # T
    draw_line(pen, cx - 40, cy + 40, cx, cy + 40, STROKE * 0.7)
    draw_line(pen, cx - 20, cy + 40, cx - 20, cy - 30, STROKE * 0.7)
    # V
    draw_line(pen, cx + 10, cy + 40, cx + 30, cy - 30, STROKE * 0.7)
    draw_line(pen, cx + 30, cy - 30, cx + 50, cy + 40, STROKE * 0.7)
    
    glyph.width = 550

def draw_220v_outlet(glyph):
    """220v outlet - '2' - circle with three lines"""
    pen = glyph.glyphPen()
    
    cx, cy = 250, 400
    r = 100
    
    draw_circle_stroke(pen, cx, cy, r, STROKE)
    
    # Three horizontal lines through
    draw_line(pen, cx - r - 20, cy + 40, cx + r + 20, cy + 40, STROKE * 0.7)
    draw_line(pen, cx - r - 20, cy, cx + r + 20, cy, STROKE * 0.7)
    draw_line(pen, cx - r - 20, cy - 40, cx + r + 20, cy - 40, STROKE * 0.7)
    
    glyph.width = 500

def draw_switch(glyph):
    """Single switch - 's' - clean $ symbol"""
    pen = glyph.glyphPen()
    
    cx, cy = 300, 400
    
    # Vertical line through center
    draw_line(pen, cx, cy - 180, cx, cy + 180, STROKE)
    
    # Top bar
    draw_line(pen, cx - 80, cy + 120, cx + 40, cy + 120, STROKE)
    
    # Top curve (left side, curving down)
    draw_arc_stroke(pen, cx - 80, cy + 60, 60, 90, 180, STROKE)
    
    # Left vertical
    draw_line(pen, cx - 140, cy + 60, cx - 140, cy + 20, STROKE)
    
    # Diagonal middle
    draw_line(pen, cx - 140, cy + 20, cx + 140, cy - 20, STROKE)
    
    # Right vertical
    draw_line(pen, cx + 140, cy - 20, cx + 140, cy - 60, STROKE)
    
    # Bottom curve (right side, curving left)
    draw_arc_stroke(pen, cx + 80, cy - 60, 60, -90, 0, STROKE)
    
    # Bottom bar
    draw_line(pen, cx - 40, cy - 120, cx + 80, cy - 120, STROKE)
    
    glyph.width = 550

def draw_three_way_switch(glyph):
    """3-way switch - '3' - $ with subscript 3W"""
    pen = glyph.glyphPen()
    
    cx, cy = 250, 420
    
    # Same $ as switch but smaller/shifted
    draw_line(pen, cx, cy - 160, cx, cy + 160, STROKE)
    draw_line(pen, cx - 70, cy + 100, cx + 35, cy + 100, STROKE)
    draw_arc_stroke(pen, cx - 70, cy + 50, 50, 90, 180, STROKE)
    draw_line(pen, cx - 120, cy + 50, cx - 120, cy + 15, STROKE)
    draw_line(pen, cx - 120, cy + 15, cx + 120, cy - 15, STROKE)
    draw_line(pen, cx + 120, cy - 15, cx + 120, cy - 50, STROKE)
    draw_arc_stroke(pen, cx + 70, cy - 50, 50, -90, 0, STROKE)
    draw_line(pen, cx - 35, cy - 100, cx + 70, cy - 100, STROKE)
    
    # Subscript "3W"
    sx, sy = 400, 280
    s = STROKE * 0.7
    
    # 3
    draw_line(pen, sx, sy + 50, sx + 35, sy + 50, s)
    draw_line(pen, sx + 15, sy + 25, sx + 35, sy + 25, s)
    draw_line(pen, sx, sy, sx + 35, sy, s)
    draw_line(pen, sx + 35, sy, sx + 35, sy + 50, s)
    
    # W
    wx = sx + 50
    draw_line(pen, wx, sy + 50, wx + 12, sy, s * 0.8)
    draw_line(pen, wx + 12, sy, wx + 24, sy + 35, s * 0.8)
    draw_line(pen, wx + 24, sy + 35, wx + 36, sy, s * 0.8)
    draw_line(pen, wx + 36, sy, wx + 48, sy + 50, s * 0.8)
    
    glyph.width = 550

def draw_ceiling_light(glyph):
    """Ceiling light - 'L' - circle with cross"""
    pen = glyph.glyphPen()
    
    cx, cy = 300, 400
    r = 110
    
    draw_circle_stroke(pen, cx, cy, r, STROKE)
    
    # Cross
    line_len = r - 15
    draw_line(pen, cx - line_len, cy, cx + line_len, cy, STROKE * 0.8)
    draw_line(pen, cx, cy - line_len, cx, cy + line_len, STROKE * 0.8)
    
    glyph.width = 500

def draw_wall_sconce(glyph):
    """Wall sconce - 'W' - semicircle with wall line"""
    pen = glyph.glyphPen()
    
    cx, cy = 300, 400
    r = 90
    
    # Half circle
    draw_arc_stroke(pen, cx, cy, r, -90, 90, STROKE)
    
    # Vertical wall line
    draw_line(pen, cx, cy - r - 30, cx, cy + r + 30, STROKE)
    
    # Connection to wall
    draw_line(pen, cx, cy, cx + 100, cy, STROKE)
    
    glyph.width = 450

def draw_ceiling_fan(glyph):
    """Ceiling fan - 'f' - circle with radiating lines"""
    pen = glyph.glyphPen()
    
    cx, cy = 300, 400
    r = 110
    
    draw_circle_stroke(pen, cx, cy, r, STROKE)
    
    # Four blade lines
    inner = 35
    outer = r - 15
    for angle in [45, 135, 225, 315]:
        a = math.radians(angle)
        draw_line(pen, cx + inner * math.cos(a), cy + inner * math.sin(a),
                 cx + outer * math.cos(a), cy + outer * math.sin(a), STROKE * 0.7)
    
    glyph.width = 500

def draw_thermostat(glyph):
    """Thermostat - '4' - T in circle"""
    pen = glyph.glyphPen()
    
    cx, cy = 300, 400
    r = 110
    
    draw_circle_stroke(pen, cx, cy, r, STROKE)
    
    # T
    draw_line(pen, cx - 50, cy + 60, cx + 50, cy + 60, STROKE)
    draw_line(pen, cx, cy + 60, cx, cy - 60, STROKE)
    
    glyph.width = 500

def draw_phone_jack(glyph):
    """Phone jack - '5' - filled triangle"""
    pen = glyph.glyphPen()
    
    # Triangle pointing right
    pen.moveTo((200, 500))
    pen.lineTo((400, 400))
    pen.lineTo((200, 300))
    pen.closePath()
    
    glyph.width = 500

def draw_doorbell(glyph):
    """Doorbell - '6' - square with filled circle"""
    pen = glyph.glyphPen()
    
    cx, cy = 300, 400
    size = 160
    
    draw_rect_stroke(pen, cx - size/2, cy - size/2, size, size, STROKE)
    
    # Filled circle
    r = 45
    segments = 32
    pen.moveTo((cx + r, cy))
    for i in range(1, segments + 1):
        a = 2 * math.pi * i / segments
        pen.lineTo((cx + r * math.cos(a), cy + r * math.sin(a)))
    pen.closePath()
    
    glyph.width = 500

def draw_floor_receptacle(glyph):
    """Floor receptacle - 'R' - square with circle inside"""
    pen = glyph.glyphPen()
    
    cx, cy = 300, 400
    size = 160
    
    draw_rect_stroke(pen, cx - size/2, cy - size/2, size, size, STROKE)
    draw_circle_stroke(pen, cx, cy, 50, STROKE * 0.7)
    
    # Line through
    draw_line(pen, cx - size/2 - 20, cy, cx + size/2 + 20, cy, STROKE * 0.7)
    
    glyph.width = 500

# =============================================================================
# PLUMBING
# =============================================================================

def draw_toilet(glyph):
    """Toilet - 't' - tank + oval bowl"""
    pen = glyph.glyphPen()
    
    # Tank (top rectangle)
    draw_rect_stroke(pen, 150, 530, 300, 100, STROKE)
    
    # Bowl (oval)
    draw_oval_stroke(pen, 300, 330, 140, 170, STROKE)
    
    glyph.width = 600

def draw_bathtub(glyph):
    """Bathtub - 'T' - rounded rectangle outline"""
    pen = glyph.glyphPen()
    
    x, y = 80, 150
    w, h = 440, 500
    r = 50  # corner radius
    s = STROKE
    
    # Outer rounded rect
    pen.moveTo((x + r, y))
    pen.lineTo((x + w - r, y))
    pen.lineTo((x + w, y + r))
    pen.lineTo((x + w, y + h - r))
    pen.lineTo((x + w - r, y + h))
    pen.lineTo((x + r, y + h))
    pen.lineTo((x, y + h - r))
    pen.lineTo((x, y + r))
    pen.closePath()
    
    # Inner rounded rect (for hollow effect)
    pen.moveTo((x + s, y + r + s))
    pen.lineTo((x + s, y + h - r - s))
    pen.lineTo((x + r + s, y + h - s))
    pen.lineTo((x + w - r - s, y + h - s))
    pen.lineTo((x + w - s, y + h - r - s))
    pen.lineTo((x + w - s, y + r + s))
    pen.lineTo((x + w - r - s, y + s))
    pen.lineTo((x + r + s, y + s))
    pen.closePath()
    
    glyph.width = 600

def draw_shower(glyph):
    """Shower - 'S' - square with X and drain circle"""
    pen = glyph.glyphPen()
    
    x, y = 100, 150
    size = 500
    
    draw_rect_stroke(pen, x, y, size, size, STROKE)
    
    # X diagonal lines
    margin = 40
    draw_line(pen, x + margin, y + margin, x + size - margin, y + size - margin, STROKE * 0.7)
    draw_line(pen, x + margin, y + size - margin, x + size - margin, y + margin, STROKE * 0.7)
    
    # Center drain circle
    draw_circle_stroke(pen, x + size/2, y + size/2, 35, STROKE * 0.6)
    
    glyph.width = 700

def draw_sink(glyph):
    """Sink - 'k' - rectangle with oval basin"""
    pen = glyph.glyphPen()
    
    x, y = 100, 200
    w, h = 400, 400
    
    draw_rect_stroke(pen, x, y, w, h, STROKE)
    draw_oval_stroke(pen, x + w/2, y + h/2, 120, 90, STROKE)
    
    glyph.width = 600

def draw_double_sink(glyph):
    """Double sink - 'K' - rectangle with two ovals"""
    pen = glyph.glyphPen()
    
    x, y = 50, 200
    w, h = 500, 400
    
    draw_rect_stroke(pen, x, y, w, h, STROKE)
    draw_oval_stroke(pen, x + w/4, y + h/2, 80, 70, STROKE)
    draw_oval_stroke(pen, x + 3*w/4, y + h/2, 80, 70, STROKE)
    
    glyph.width = 600

def draw_hot_water_heater(glyph):
    """Hot water heater - 'h' - circle with WH"""
    pen = glyph.glyphPen()
    
    cx, cy = 300, 400
    r = 150
    
    draw_circle_stroke(pen, cx, cy, r, STROKE)
    
    # WH text
    # W
    draw_line(pen, 190, 470, 210, 350, STROKE * 0.7)
    draw_line(pen, 210, 350, 240, 420, STROKE * 0.7)
    draw_line(pen, 240, 420, 270, 350, STROKE * 0.7)
    draw_line(pen, 270, 350, 290, 470, STROKE * 0.7)
    
    # H
    draw_line(pen, 320, 350, 320, 470, STROKE * 0.7)
    draw_line(pen, 390, 350, 390, 470, STROKE * 0.7)
    draw_line(pen, 320, 410, 390, 410, STROKE * 0.7)
    
    glyph.width = 600

def draw_dishwasher(glyph):
    """Dishwasher - '7' - rectangle with DW"""
    pen = glyph.glyphPen()
    
    x, y = 100, 200
    w, h = 400, 400
    
    draw_rect_stroke(pen, x, y, w, h, STROKE)
    
    # DW - D
    draw_line(pen, 160, 340, 160, 460, STROKE * 0.7)
    draw_arc_stroke(pen, 160, 400, 60, -90, 90, STROKE * 0.7)
    
    # W
    draw_line(pen, 280, 460, 305, 340, STROKE * 0.6)
    draw_line(pen, 305, 340, 335, 420, STROKE * 0.6)
    draw_line(pen, 335, 420, 365, 340, STROKE * 0.6)
    draw_line(pen, 365, 340, 390, 460, STROKE * 0.6)
    
    glyph.width = 600

def draw_range(glyph):
    """Range/Stove - '8' - rectangle with 4 burner circles"""
    pen = glyph.glyphPen()
    
    x, y = 80, 150
    w, h = 440, 500
    
    draw_rect_stroke(pen, x, y, w, h, STROKE)
    
    # Four burners
    br = 55
    positions = [
        (x + w/4, y + h/4 + 30),
        (x + 3*w/4, y + h/4 + 30),
        (x + w/4, y + 3*h/4 - 30),
        (x + 3*w/4, y + 3*h/4 - 30),
    ]
    for bx, by in positions:
        draw_circle_stroke(pen, bx, by, br, STROKE * 0.6)
    
    glyph.width = 600

def draw_dryer(glyph):
    """Dryer - '9' - rectangle with circle inside"""
    pen = glyph.glyphPen()
    
    x, y = 100, 200
    w, h = 400, 400
    
    draw_rect_stroke(pen, x, y, w, h, STROKE)
    draw_circle_stroke(pen, x + w/2, y + h/2, 120, STROKE * 0.7)
    
    glyph.width = 600

def draw_washer(glyph):
    """Washer - '0' - rectangle with circle inside"""
    pen = glyph.glyphPen()
    
    x, y = 100, 200
    w, h = 400, 400
    
    draw_rect_stroke(pen, x, y, w, h, STROKE)
    draw_circle_stroke(pen, x + w/2, y + h/2, 100, STROKE * 0.7)
    
    # Small circle in center
    draw_circle_stroke(pen, x + w/2, y + h/2, 30, STROKE * 0.5)
    
    glyph.width = 600

# =============================================================================
# MATERIAL HATCHING
# =============================================================================

def draw_brick(glyph):
    """Brick hatch - 'B' - diagonal lines"""
    pen = glyph.glyphPen()
    
    # Box outline
    x, y = 100, 200
    w, h = 400, 400
    draw_rect_stroke(pen, x, y, w, h, STROKE)
    
    # Diagonal hatch lines (45 degrees)
    spacing = 40
    for i in range(-10, 15):
        start_x = x + i * spacing
        start_y = y
        end_x = start_x + h
        end_y = y + h
        
        # Clip to box
        if start_x < x:
            start_y = y + (x - start_x)
            start_x = x
        if end_x > x + w:
            end_y = y + h - (end_x - (x + w))
            end_x = x + w
        if start_y < y or end_y > y + h:
            continue
            
        draw_line(pen, start_x, start_y, end_x, end_y, STROKE * 0.4)
    
    glyph.width = 600

def draw_concrete(glyph):
    """Concrete/cement - 'C' - dots pattern"""
    pen = glyph.glyphPen()
    
    x, y = 100, 200
    w, h = 400, 400
    draw_rect_stroke(pen, x, y, w, h, STROKE)
    
    # Random-ish dots
    import random
    random.seed(42)
    for _ in range(30):
        dx = random.randint(int(x + 30), int(x + w - 30))
        dy = random.randint(int(y + 30), int(y + h - 30))
        r = random.randint(3, 8)
        
        pen.moveTo((dx + r, dy))
        for i in range(1, 13):
            a = 2 * math.pi * i / 12
            pen.lineTo((dx + r * math.cos(a), dy + r * math.sin(a)))
        pen.closePath()
    
    glyph.width = 600

# =============================================================================
# MAIN
# =============================================================================

def main():
    print("Creating Architectural Symbols font v3...")
    
    font = create_font()
    
    symbols = [
        # Architectural
        ('d', draw_door, "Door"),
        ('D', draw_sliding_door, "Sliding_Door"),
        ('b', draw_bifold_door, "Bifold_Door"),
        ('p', draw_pocket_door, "Pocket_Door"),
        ('w', draw_window, "Window"),
        ('F', draw_french_door, "French_Door"),
        
        # Electrical
        ('o', draw_duplex_outlet, "Duplex_Outlet"),
        ('O', draw_switched_outlet, "Switched_Outlet"),
        ('v', draw_tv_outlet, "TV_Outlet"),
        ('2', draw_220v_outlet, "220V_Outlet"),
        ('s', draw_switch, "Switch"),
        ('3', draw_three_way_switch, "Three_Way_Switch"),
        ('L', draw_ceiling_light, "Ceiling_Light"),
        ('W', draw_wall_sconce, "Wall_Sconce"),
        ('f', draw_ceiling_fan, "Ceiling_Fan"),
        ('4', draw_thermostat, "Thermostat"),
        ('5', draw_phone_jack, "Phone_Jack"),
        ('6', draw_doorbell, "Doorbell"),
        ('R', draw_floor_receptacle, "Floor_Receptacle"),
        
        # Plumbing
        ('t', draw_toilet, "Toilet"),
        ('T', draw_bathtub, "Bathtub"),
        ('S', draw_shower, "Shower"),
        ('k', draw_sink, "Sink"),
        ('K', draw_double_sink, "Double_Sink"),
        ('h', draw_hot_water_heater, "Hot_Water_Heater"),
        ('7', draw_dishwasher, "Dishwasher"),
        ('8', draw_range, "Range"),
        ('9', draw_dryer, "Dryer"),
        ('0', draw_washer, "Washer"),
        
        # Materials
        ('B', draw_brick, "Brick_Hatch"),
        ('C', draw_concrete, "Concrete"),
    ]
    
    for char, draw_func, name in symbols:
        print(f"  '{char}' - {name}")
        glyph = font.createChar(ord(char))
        glyph.glyphname = name
        try:
            draw_func(glyph)
            glyph.simplify()
            glyph.round()
        except Exception as e:
            print(f"    Error: {e}")
    
    space = font.createChar(ord(' '))
    space.width = 300
    
    output_path = "/home/claude/ArchSymbols.ttf"
    print(f"\nSaving to: {output_path}")
    font.generate(output_path)
    print("Done!")

if __name__ == "__main__":
    main()
