var Chip8 = (function(){
	// bind utility method
	var _bind = function(fn, thisArg) {
		return function() {
			fn.call(thisArg, arguments);
		};
	};

  function Chip8(drawScreenCallback) {
    this.reset();
    this.drawScreenCallback = drawScreenCallback;
  }
  
  Chip8.prototype.reset = function reset() {
    this.programCounter = 0;
    this.memory = new Array(4096);
    this.stack = new Array(16);
    this.stackPointer = 0;
    this.v = new Array(16);
    this.i = 0;
    this.delayTimer = 0;
    this.soundTimer = 0;

    this.isAwaitingInput = false;
    this.currentKey = null;

    this.resetScreen();

    // initialize memory for hex character sprites
    var hexChars = [
    	0xF0, 0x90, 0x90, 0x90, 0xF0, // 0
    	0x20, 0x60, 0x20, 0x20, 0x70, // 1
    	0xF0, 0x10, 0xF0, 0x80, 0xF0, // 2
    	0xF0, 0x10, 0xF0, 0x10, 0xF0, // 3
    	0x90, 0x90, 0xF0, 0x10, 0x10, // 4
    	0xF0, 0x80, 0xF0, 0x10, 0xF0, // 5
    	0xF0, 0x80, 0xF0, 0x90, 0xF0, // 6
    	0xF0, 0x10, 0x20, 0x40, 0x40, // 7
    	0xF0, 0x90, 0xF0, 0x90, 0xF0, // 8
    	0xF0, 0x90, 0xF0, 0x10, 0xF0, // 9
    	0xF0, 0x90, 0xF0, 0x90, 0x90, // A
    	0xE0, 0x90, 0xE0, 0x90, 0xE0, // B
    	0xF0, 0x80, 0x80, 0x80, 0xF0, // C
    	0xE0, 0x90, 0x90, 0x90, 0xE0, // D
    	0xF0, 0x80, 0xF0, 0x80, 0xF0, // E
    	0xF0, 0x80, 0xF0, 0x80, 0x80  // F
    ];

    var hexCharIndex;
    for(hexCharIndex = 0; hexCharIndex < hexChars.length; hexCharIndex++) {
    	this.memory[hexCharIndex] = hexChars[hexCharIndex];
    }

    // bind start method
    this.start = _bind(this.start, this);
  };

  Chip8.prototype.resetScreen = function resetScreen() {
    // set up 2-dimensional graphics array 64x32
    var widthPixels = 64, heightPixels = 32;

    this.graphicsData = new Array(widthPixels);
    for (var arrayIndex = 0; arrayIndex < this.graphicsData.length; arrayIndex++) {
    	this.graphicsData[arrayIndex] = new Array(heightPixels);

    	// seed all values to 0
    	for (var arrayIndex2 = 0; arrayIndex2 < this.graphicsData[arrayIndex].length; arrayIndex2++) {
    		this.graphicsData[arrayIndex][arrayIndex2] = 0;
    	}
    }
  };
  
  Chip8.prototype.readNextOpcode = function getOpcode() {
    // get the opcode from memory
    // it's two bytes long, so read the current byte and the next one
    var opcode = this.memory[this.programCounter] << 8 | this.memory[this.programCounter + 1];
    
    // move the program counter
    this.programCounter += 2;
    
    // return the opcode
    return opcode;
  };
  
  Chip8.prototype.processOpcode = function processOpcode(opcode) {
    // mask the opcode to get the first byte
    switch(opcode & 0xF000) {
      case 0x0:
        // 00E0 - clears the screen
        if (opcode === 0x00E0) {
            this.resetScreen();
            break;
        }
        
        // 00EE - return from a subroutine
        if (opcode === 0x00EE) {
            // return from subroutine (use stack to do so)
            // decrement the stackPointer
            this.stackPointer--;

            // set the program counter to the address stored in the stack where the stackPointer is pointing
            this.programCounter = this.stack[this.stackPointer];
            break;
        }
        
        // 0NNN - call program at address NNN (unsupported)
        
        break;
          
      case 0x1000:
        // 1NNN - jump to address NNN
        this.programCounter = opcode & 0x0FFF;
        break;
          
      case 0x2000:
        // 2NNN - call subroutine at NNN
        // store the current location in the stack, then increment the stack pointer
        this.stack[this.stackPointer] = this.programCounter;
        this.stackPointer++;
        
        // read the address from the instruction
        this.programCounter = opcode & 0x0FFF;
        
        break;
          
      case 0x3000:
        // 3XNN - skip the next instruction if VX equals NN
        if (this.v[(opcode & 0x0F00) >> 8] === (opcode & 0x00FF)) {
        	this.programCounter += 2;
        }
        break;
          
      case 0x4000:
        // 4XNN - skip the next instruction if VX doesn't equal NN
        if (this.v[(opcode & 0x0F00) >> 8] !== (opcode & 0x00FF)) {
        	this.programCounter += 2;
        }
        break;
          
      case 0x5000:
        // 5XY0 - skip the next instruction if VX equals VY
        if (this.v[(opcode & 0x0F00) >> 8] === this.v[(opcode & 0x00F0) >> 4]) {
        	this.programCounter += 2;
        }
        break;
          
      case 0x6000:
        // 6XNN - sets VX to NN
        this.v[(opcode & 0x0F00) >> 8] = opcode & 0x00FF;
        break;
          
      case 0x7000:
        // 7XNN - adds NN to VX
        this.v[(opcode & 0x0F00) >> 8] += opcode & 0x00FF;
        break;
          
      case 0x8000:
    		// these commands all use similar arguments
    		var x = (opcode & 0x0F00) >> 8;
    		var y = (opcode & 0x00F0) >> 4;
    		var lastArg = opcode & 0x000F;

        // 8XY0 - sets VX to the value of VY
        if (lastArg === 0) {
        	this.v[x] = this.v[y];
        	break;
        }

        // 8XY1 - sets VX to VX OR VY
        if (lastArg === 1) {
        	this.v[x] = this.v[x] | this.v[y];
        }

        // 8XY2 - sets VX to VX AND VY
        if (lastArg === 2) {
        	this.v[x] &= this.v[y];
        }

        // 8XY3 - sets VX to VX XOR VY
        if (lastArg === 3) {
        	this.v[x] ^= this.v[y];
        }
        
        // 8XY4 - adds VY to VX. VF is set to 1 when there's a carry, and to 0 when there isn't
        if (lastArg === 4) {
        	this.v[x] += this.v[y];
        	if (this.v[x] >= 0x100) {
        		this.v[x] -= 0x100;
          	this.v[0xf] = 1;
        	} else {
          	this.v[0xf] = 0;
        	}
        }
        
        // 8XY5 - VY is subtracted from VX. VF is set to 0 when there's a borrow, and 1 when there isn't.
        if (lastArg === 5) {
        	this.v[x] -= this.v[y];
        	if (this.v[x] < 0) {
        		this.v[x] += 0xff;
        		this.v[0xf] = 0;
        	} else {
          	this.v[0xf] = 1;
          }
        }
        
        // 8XY6 - Shifts VX right by one. VF is set to the value of the least significant bit of VX before the shift
        if (lastArg === 6) {
        	this.v[0xf] = this.v[x] & 0x01;
        	this.v[x] >>= 1;
        }
        
        // 8XY7 - sets VX to VY minus VX. VF is set to 0 when there's a borrow, and 1 when there isn't
        if (lastArg === 7) {
        	this.v[x] = this.v[y] - this.v[x];
        	if (this.v[x] < 0) {
        		this.v[x] += 0xFF;
        		this.v[0xF] = 0;
        	} else {
        		this.v[0xF] = 1;              		
        	}
        }
        
        // 8XYE - shifts VX left by one. VF is set to the value of the most significant bit of VS before the shift
        if (lastArg === 0xE) {
        	this.v[0xf] = (this.v[x] & 0x80) >> 7; // store the most significant bit in VF
        	this.v[x] <<= 1; // shift left
        	this.v[x] &= 0xFF; // mask it in case the most significant bit was 0
        }
        
        break;
          
      case 0x9000:
        // 9XY0 - skips the next instruction if VX doesn't equal VY
        if (this.v[(opcode & 0x0F00) >> 8] !== this.v[(opcode & 0x00F0) >> 4]) {
        	this.programCounter += 2;
        }
        break;
          
      case 0xA000:
        // ANNN - sets I to the address NNN
        this.i = (opcode & 0x0FFF);
        break;
          
      case 0xB000:
        // BNNN - jumps to the address NNN plus V0
        this.programCounter = this.v[0] + opcode & 0x0FFF;
        break;
          
      case 0xC000:
        // CXNN - sets VX to a random number and NN
        this.v[(opcode & 0x0F00) >> 8] = Math.round(Math.random() * 0xFF);
        break;
          
      case 0xD000:
        // DXYN - draws a sprite at coordinate (VX, VY) that has a width of 8 pixels 
        // and a height of N pixels. Each row of 8 pixels is read as a bit-coded 
        // (with the most significant bit of each byte displayed on the left) 
        // starting from memory location I; I value doesn't change after the execution 
        // of this instruction. As described above, VF is set to 1 if any screen 
        // pixels are flipped from set to unset when the sprite is drawn, and to 0 
        // if that doesn't happen.

        if ((opcode & 0xF000) === 0xD000) {
					var x = this.v[(opcode & 0x0F00) >> 8];
					var y = this.v[(opcode & 0x00F0) >> 4];
					var lastOffset = (opcode & 0x000F) - 1;
					var offset;
					var bit;
					var bitValue;

					// for each memory location, a row 8 pixels wide is represented
					// y will increment for each memory location, and x will increment for each bit
					for (offset = 0; offset <= lastOffset; offset++) {
						// for each bit in the memory location
						for (bit = 0; bit < 8; bit += 1) {
							// get the value for the current bit by raising 2 to the power 
							// of 7 - bit, then shifting the value to isloate that bit as a 
							// 1 or 0.
							bitValue = (this.memory[this.i + offset] & Math.pow(2, (7 - bit))) >> (7 - bit);

							// use XOR to make sure that the bit is flipped when a 1 is 
							// present in the memory, and is left alone when a 0 is present.
							this.graphicsData[x + bit][y + offset] ^= bitValue;
						}
					}
				}

        break;
          
      case 0xE000:
        // EX9E - skips the next instruction if the key stored in VX is pressed
        if ((opcode & 0xF0FF) === 0xE09E) {
        	if (this.currentKey === this.v[(opcode & 0x0F00) >> 8]) {
        		this.programCounter += 1;
        	}
        }

        // EXA1 - skips the next instruction if the key stored in VX isn't pressed
        if ((opcode & 0xF0FF) === 0xE0A1) {
        	if (this.currentKey !== this.v[(opcode & 0x0F00) >> 8]) {
        		this.programCounter += 1;
        	}
        }

        break;
          
      case 0xF000:
        // FX07 - sets VX to the value of the delay timer
        if ((opcode & 0xF0FF) === 0xF007) {
        	this.v[(opcode & 0x0F00) >> 8] = this.delayTimer;
        }

        // FX0A - a key press is awaited, and then stored in VX
        if ((opcode & 0xF0FF)=== 0xF00A) {
        	// set the state of Chip8 to waiting on input
        	this.isAwaitingInput = true;
        }

        // FX15 - sets the delay timer to VX
        if ((opcode & 0xF0FF) === 0xF015) {
        	this.delayTimer = this.v[(opcode & 0x0F00) >> 8];
        }

        // FX18 - sets the sound timer to VX
        if ((opcode & 0xF0FF) === 0xF018) {
        	this.soundTimer = this.v[(opcode & 0x0F00) >> 8];
        }

        // FX1E - adds VX to I
        if ((opcode & 0xF0FF) === 0xF01E) {
        	this.i += this.v[(opcode & 0x0F00) >> 8];
        	if (this.i > 0xFFF) {
        		this.i &= 0xFFF;
        		this.v[0xf] = 1;
        	} else {
          	this.v[0xf] = 0;
        	}
        }

        // FX29 - sets I to the location of the sprite for the character in VX. 
        // Characters 0-F (in hex) are represented by a 4x5 font.
        if ((opcode & 0xF0FF) === 0xF029) {
        	var character = this.v[(opcode & 0x0F00) >> 8];
        	if (character >= 0 && character <= 0xF) {
        		this.i = character * 5;
        	}
        }

        // FX33 - stores the binary-coded decimal representation of VX, with the 
        // most significant of three digits at the address in I, the middle digit 
        // at I plus 1, and the least significant digit at I plus 2.
        if ((opcode & 0xF0FF) === 0xF033) {
        	var value = this.v[(opcode & 0x0F00) >> 8];
        	var currentDigit = 0;
        	var digits = [];
        	var power;

        	// shortcut all this complicated logic when the value is easy to find
        	if (value < 10) {
        		this.memory[this.i] = value;
        	} else if (value < 100) {
        		// find the "tens" digit - divide by 10 and floor the result
        		this.memory[this.i] = Math.floor(value / 10);

        		// find the "ones" digit by taking the value and subtracting the "tens"
        		this.memory[this.i + 1] = value - this.memory[this.i] * 10;
        	} else {
        		// find the "hundreds" digit - divide by 100 and floor the result
        		this.memory[this.i] = Math.floor(value / 100);

        		// find the "tens" digit by taking the value and subtracting the "hundreds", then
        		// dividing by 10 and flooring the result.
        		this.memory[this.i + 1] = Math.floor((value - this.memory[this.i] * 100) / 10);

        		// find the "ones" digit by taking the value and subtracting the "hundreds" and "tens"
        		this.memory[this.i + 2] = value - this.memory[this.i] * 100 - this.memory[this.i + 1] * 10;
        	}
        }

        // FX55 - stores V0 to VX in memory starting at address I
        if ((opcode & 0xF0FF) === 0xF055) {
        	var lastVIndex = (opcode & 0x0F00) >> 8;
        	var vIndex;

        	for (vIndex = 0; vIndex <= lastVIndex; vIndex++) {
        		this.memory[this.i + vIndex] = this.v[vIndex];
        	}
        }

        // FX65 - fills V0 to VX with values from memory starting at address I
        if ((opcode & 0xF0FF) === 0xF065) {
        	var lastVIndex = (opcode & 0x0F00) >> 8;
        	var vIndex;

        	for (vIndex = 0; vIndex <= lastVIndex; vIndex++) {
        		this.v[vIndex] = this.memory[this.i + vIndex];
        	}
        }

        break;
    }
  };

  Chip8.prototype.start = function() {
  	if (this.programCounter <= 0xFFF) {
  		this.tick();

  		// use setTimeout method to get clock speed to be 1.76 MHz
  		setTimeout(this.start, 1 / 1.76e6);

  		// use request animation frame to do the next frame also
  		//window.requestAnimationFrame(this.start);
  	}
  };

  Chip8.prototype.tick = function() {
  	// if a key is currently pressed and the program is awaiting input, change
  	// the state
  	if (this.isAwaitingInput === true && this.currentKey !== null) {
  		this.isAwaitingInput = false;
  	}

  	if (!this.isAwaitingInput) {
    	this.processNextOpcode();
    }

    // draw graphics
    if (this.drawScreenCallback) {
	    this.drawScreenCallback(this.graphicsData);
	  }
  };

  Chip8.prototype.keypress = function(key) {
  	this.currentKey = key;
  };

  Chip8.prototype.keyup = function() {
  	this.currentKey = null;
  };
  
  Chip8.prototype.processNextOpcode = function processNextOpcode() {
    this.delayTimer -= 1;
    this.soundTimer -= 1;

    var opcode = this.readNextOpcode();
    this.processOpcode(opcode);
  };

  Chip8.prototype.loadProgram = function loadProgram(program) {
  	// load in the program starting at memory address 0x200
  	// load program into memory starting at 0x200
		var memoryPointer = 0x200;
		var programIndex;
		var currentInstruction;

		for(programIndex = 0; programIndex < program.length; programIndex++) {
			currentInstruction = program[programIndex];
			this.memory[memoryPointer] = (currentInstruction & 0xFF00) >> 8;
			memoryPointer++;

			this.memory[memoryPointer] = (currentInstruction & 0x00FF);
			memoryPointer++;
		}

		// set program counter to 0x200
		this.programCounter = 0x200;
  };
  
  return Chip8;
}());