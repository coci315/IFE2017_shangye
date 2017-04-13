var emitter = {
  // 注册事件
  on: function (event, fn) {
    var handles = this._handles || (this._handles = {}),
      calls = handles[event] || (handles[event] = []);

    // 找到对应名字的栈
    calls.push(fn);

    return this;
  },
  // 解绑事件
  off: function (event, fn) {
    if (!event || !this._handles) this._handles = {};
    if (!this._handles) return;

    var handles = this._handles,
      calls;

    if (calls = handles[event]) {
      if (!fn) {
        handles[event] = [];
        return this;
      }
      // 找到栈内对应listener 并移除
      for (var i = 0, len = calls.length; i < len; i++) {
        if (fn === calls[i]) {
          calls.splice(i, 1);
          return this;
        }
      }
    }
    return this;
  },
  // 触发事件
  emit: function (event) {
    var args = [].slice.call(arguments, 1),
      handles = this._handles,
      calls;

    if (!handles || !(calls = handles[event])) return this;
    // 触发所有对应名字的listeners
    for (var i = 0, len = calls.length; i < len; i++) {
      calls[i].apply(this, args)
    }
    return this;
  }
};

// 赋值属性
// extend({a:1}, {b:1, a:2}) -> {a:1, b:1}
function extend(o1, o2) {
  for (var i in o2)
    if (typeof o1[i] === 'undefined') {
      o1[i] = o2[i]
    }
  return o1;
}

function ColorPicker() {
  this.container = document.querySelector('.container');
  this.divColorBlock = this.container.querySelector('.colorBlock');
  this.cvColorBlock = document.getElementById('colorBlock');
  this.ctxColorBlock = this.cvColorBlock.getContext('2d');
  this.divColorBar = this.container.querySelector('.colorBar');
  this.cvColorBar = document.getElementById('colorBar');
  this.ctxColorBar = this.cvColorBar.getContext('2d');
  this.ctrlColorBar = this.container.querySelector('.colorBar .control');
  this.ctrlColorBar.flag = false;
  this.ctrlColorBlock = this.container.querySelector('.colorBlock .control');
  this.ctrlColorBlock.flag = false;
  this.inputGroup = this.container.querySelector('.inputGroup');
  this.inputR = this.inputGroup.R;
  this.inputG = this.inputGroup.G;
  this.inputB = this.inputGroup.B;
  this.inputH = this.inputGroup.H;
  this.inputS = this.inputGroup.S;
  this.inputL = this.inputGroup.L;
  this._getCanvasRange(this.cvColorBar);
  this._getCanvasRange(this.cvColorBlock);
  this._initColorBar();
  this._fillColorBlockByColorBarCtrlPos();
  this._updateInputGroup();

  this._initEvent();
}

ColorPicker.prototype = {
  constructor: ColorPicker,
  // 帮助函数
  helper: {
    rgb2hsl: function (arrayRGB) {
      var r = arrayRGB[0] / 255;
      var g = arrayRGB[1] / 255;
      var b = arrayRGB[2] / 255;
      var min = Math.min.apply(Array, [r, g, b]);
      var max = Math.max.apply(Array, [r, g, b]);
      var h, s, l;
      if (max == min) {
        h = 0;
      } else if (max == r && g >= b) {
        h = 60 * (g - b) / (max - min);
      } else if (max == r && g < b) {
        h = 60 * (g - b) / (max - min) + 360;
      } else if (max == g) {
        h = 60 * (b - r) / (max - min) + 120;
      } else if (max == b) {
        h = 60 * (r - g) / (max - min) + 240;
      }
      l = (max + min) / 2;
      if (l == 0 || max == min) {
        s = 0;
      } else if (l > 0 && l <= 0.5) {
        s = (max - min) / (2 * l);
      } else if (l > 0.5) {
        s = (max - min) / (2 - 2 * l);
      }

      return [Math.round(h), Math.round(s * 100) / 100, Math.round(l * 100) / 100];
    },

    hsl2rgb: function (arrayHSL) {
      var h = arrayHSL[0];
      var s = arrayHSL[1];
      var l = arrayHSL[2];

      var r, g, b;
      if (s == 0) {
        r = g = b = l;
      } else {
        var p, q, k;
        if (l < 0.5) {
          q = l * (1 + s);
        } else if (l >= 0.5) {
          q = l + s - (l * s);
        }
        p = 2 * l - q;
        k = h / 360;
        r = singleColorCalculation(k + 1 / 3);
        g = singleColorCalculation(k);
        b = singleColorCalculation(k - 1 / 3);
      }

      return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];

      function singleColorCalculation(k) {
        var color;
        if (k < 0) {
          k += 1;
        }
        if (k > 1) {
          k -= 1;
        }
        if (k * 6 < 1) {
          color = p + ((q - p) * 6 * k);
        } else if (k * 6 >= 1 && k < 0.5) {
          color = q;
        } else if (k >= 0.5 && 3 * k < 2) {
          color = p + ((q - p) * 6 * (2 / 3 - k));
        } else {
          color = p;
        }

        return color;
      }
    },

    // 获取节点的左上角距离页面左侧以及上侧边缘的距离
    getOffsetObj: function (node) {
      var left = node.offsetLeft;
      var top = node.offsetTop;
      while (node.offsetParent !== document.body) {
        node = node.offsetParent;
        left += node.offsetLeft;
        top += node.offsetTop;
      }
      return {
        offsetLeft: left,
        offsetTop: top
      };
    },
    // mouseDown事件，将相关信息存储在对应node节点上
    mouseDownHandler: function (event, node) {
      node.posX = event.pageX;
      node.posY = event.pageY;
      node.flag = true;
    },

    mouseMoveHandler: function (event, node, range, isMoveLeft, isMoveTop) {
      if (!node.flag) return;
      if (typeof isMoveLeft == 'undefined') isMoveLeft = true;
      if (typeof isMoveTop == 'undefined') isMoveTop = true;
      var toControlCenterLeft = node.posX - (range.minX + node.offsetLeft + parseInt(node.offsetWidth / 2));
      var toControlCenterTop = node.posY - (range.minY + node.offsetTop + parseInt(node.offsetHeight / 2));
      var newPosX = event.pageX;
      var newPosY = event.pageY;
      if (newPosX < range.minX + toControlCenterLeft) {
        newPosX = range.minX + toControlCenterLeft;
      }
      if (newPosX > range.maxX + toControlCenterLeft) {
        newPosX = range.maxX + toControlCenterLeft;
      }
      if (newPosY < range.minY + toControlCenterTop) {
        newPosY = range.minY + toControlCenterTop;
      }
      if (newPosY > range.maxY + toControlCenterTop) {
        newPosY = range.maxY + toControlCenterTop;
      }
      var left = node.offsetLeft;
      var top = node.offsetTop;
      if (isMoveLeft) node.style.left = left + (newPosX - node.posX) + 'px';
      if (isMoveTop) node.style.top = top + (newPosY - node.posY) + 'px';
      node.posX = newPosX;
      node.posY = newPosY;
    },

    mouseUpHandler: function (event, node) {
      node.flag = false;
    }
  },

  // 初始化colorBar颜色填充
  _initColorBar: function () {
    var ctx = this.ctxColorBar;
    var lingrad = ctx.createLinearGradient(0, 0, 0, 500);
    lingrad.addColorStop(0, '#f00');
    lingrad.addColorStop(1 / 6, '#ff0');
    lingrad.addColorStop(2 / 6, '#0f0');
    lingrad.addColorStop(3 / 6, '#0ff');
    lingrad.addColorStop(4 / 6, '#00f');
    lingrad.addColorStop(5 / 6, '#f0f');
    lingrad.addColorStop(1, '#f00');
    ctx.fillStyle = lingrad;
    ctx.fillRect(0, 0, 30, 500);
  },

  // 根据颜色来填充colorBlock
  _fillColorBlock: function (color) {
    var ctx = this.ctxColorBlock;
    var lingradH = ctx.createLinearGradient(0, 0, 0, 500);
    lingradH.addColorStop(0, '#fff');
    lingradH.addColorStop(1, color);
    ctx.fillStyle = lingradH;
    ctx.fillRect(0, 0, 500, 500);

    var lingradV = ctx.createLinearGradient(0, 0, 500, 0);
    lingradV.addColorStop(0, 'rgba(0,0,0,0)');
    lingradV.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = lingradV;
    ctx.fillRect(0, 0, 500, 500);
  },

  // 根据colorBar控制条中心点的位置来填充colorBlock
  _fillColorBlockByColorBarCtrlPos: function () {
    var posObj = this._getControlPos(this.ctrlColorBar);
    var colorArray = this._pickColor(this.ctxColorBar, posObj);
    var color = 'rgb(' + colorArray.join(',') + ')';
    this._fillColorBlock(color);
  },

  // 根据canvas中的坐标获取该坐标的像素信息
  _pickColor: function (canvasCtx, posObj) {
    var pixel = canvasCtx.getImageData(posObj.x, posObj.y, 1, 1);
    var data = pixel.data;
    var colorArray = data.slice(0, 3);
    return colorArray;
  },

  // 获取canvas节点的左上角以及右下角距离页面左侧以及上侧边缘的距离
  _getCanvasRange: function (canvasNode) {
    var offsetObj = this.helper.getOffsetObj(canvasNode);
    var minX = offsetObj.offsetLeft;
    var minY = offsetObj.offsetTop;
    var maxX = minX + canvasNode.offsetWidth - 1;
    var maxY = minY + canvasNode.offsetHeight - 1;
    canvasNode.range = {
      minX: minX,
      minY: minY,
      maxX: maxX,
      maxY: maxY
    };
  },

  // 设置控制条的位置
  _setControlPos: function (event, controlNode, canvasNode, isMoveLeft, isMoveTop) {
    if (typeof isMoveLeft == 'undefined') isMoveLeft = true;
    if (typeof isMoveTop == 'undefined') isMoveTop = true;
    var x = event.pageX;
    var y = event.pageY;
    if (isMoveLeft) controlNode.style.left = x - canvasNode.range.minX - parseInt(controlNode.offsetWidth / 2) + 'px';
    if (isMoveTop) controlNode.style.top = y - canvasNode.range.minY - parseInt(controlNode.offsetHeight / 2) + 'px';
  },

  // 获取控制条中心点距离offseParent左上角的距离，可以用于canvas中获取该点的像素信息
  _getControlPos: function (node) {
    return {
      x: node.offsetLeft + parseInt(node.offsetWidth / 2),
      y: node.offsetTop + parseInt(node.offsetHeight / 2)
    }
  },

  // 获取colorBlock控制条中心点的颜色
  getColor: function () {
    var posObj = this._getControlPos(this.ctrlColorBlock);
    var colorArray = this._pickColor(this.ctxColorBlock, posObj);
    return colorArray;
  },

  // 更新RGB input的值
  _updateRGBInput: function () {
    var colorArray = this.getColor();
    this.inputR.value = colorArray[0];
    this.inputG.value = colorArray[1];
    this.inputB.value = colorArray[2];
  },

  // 更新HSL input的值
  _updateHSLInput: function () {
    var colorArray = this.getColor();
    colorArray = this.helper.rgb2hsl(colorArray);
    this.inputH.value = colorArray[0];
    this.inputS.value = colorArray[1];
    this.inputL.value = colorArray[2];
  },

  // 更新RGB和HSL input的值
  _updateInputGroup: function () {
    this._updateRGBInput();
    this._updateHSLInput();
  },

  // 初始化事件
  _initEvent: function () {
    var that = this;
    // 点击colorBar的canvas时，移动colorBar的控制条
    this.cvColorBar.addEventListener('click', function (e) {
      that._setControlPos(e, that.ctrlColorBar, that.cvColorBar, false);
      that._fillColorBlockByColorBarCtrlPos();
      that._updateInputGroup();
    });
    // colorBar添加鼠标拖动事件，让控制条可以拖动控制
    this.ctrlColorBar.addEventListener('mousedown', function (e) {
      that.helper.mouseDownHandler(e, that.ctrlColorBar);
    });
    this.divColorBar.addEventListener('mousemove', function (e) {
      that.helper.mouseMoveHandler(e, that.ctrlColorBar, that.cvColorBar.range, false);
      if (that.ctrlColorBar.flag) {
        that._fillColorBlockByColorBarCtrlPos();
        that._updateInputGroup();
      }
    });
    document.addEventListener('mouseup', function (e) {
      that.helper.mouseUpHandler(e, that.ctrlColorBar);
    });
    // 点击colorBlock的canvas时，移动colorBlock的控制条
    this.cvColorBlock.addEventListener('click', function (e) {
      that._setControlPos(e, that.ctrlColorBlock, that.cvColorBlock);
      that._updateInputGroup();

    });
    // colorBlock添加鼠标拖动事件，让控制条可以拖动控制
    this.ctrlColorBlock.addEventListener('mousedown', function (e) {
      that.helper.mouseDownHandler(e, that.ctrlColorBlock);
    });
    this.divColorBlock.addEventListener('mousemove', function (e) {
      that.helper.mouseMoveHandler(e, that.ctrlColorBlock, that.cvColorBlock.range);
      if (that.ctrlColorBlock.flag) {
        that._updateInputGroup();
      }
    });
    document.addEventListener('mouseup', function (e) {
      that.helper.mouseUpHandler(e, that.ctrlColorBlock);
    });
  }
};

// 使用混入Mixin的方式使得ColorPicker具有事件发射器功能
extend(ColorPicker.prototype, emitter);

var colorPicker = new ColorPicker();