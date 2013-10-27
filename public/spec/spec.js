// spec.js
describe('chip8', function(){

	var emulator;
	
	beforeEach(function(){
		emulator = new Chip8();	
	});

	it('loads program', function(){
		var program = [
  			0x6000, // 200: set V0 (the character to display)
  			0x6101, //      set x (V1) to 1 (to store x coord of sprite position)
  			0x6201, //      set y (V2) to 1 (to store y coord of sprite position)
  			0x6439, //      set max_x (V4) to 57
     
  			0x4010, //      if V0 is not equal to 10, skip next instruction
  			0x1FFF, //      jump out of program
     
  			0x2210, //      call subroutine
  			0x1206, //      jump to "if" check

  			// start subroutine
  			0xF029, // 210: set I to the start address of the character in V0
  			0xD125, //      draw sprite for 5 bytes at coords V1, V2
     
  			0x7001, //      increment V0 (character to display) by 1
  			0x7105, //      increment V1 (x) by 5

  			// if x > max_x, increment y by 6, reset x to 0
  			0x8310, //      copy value of x (V1) into x2 (V3)
  			0x8345, //      subtract max_x (V4) from x2 (V3)
  			0x3F00, //      skip next instruction if result was positive (VF = 0)
  			0x1222, //      jump to is negative case
  			0x1226, // 220: jump to return from subroutine

  			// is negative case
  			0x6101, //      set x (V1) to 0
  			0x7206, //      increment y (V2) by 6

  			0x00EE  //      return from subroutine
  		];

  	// loads program into memory starting at 0x200
  	emulator.loadProgram(program);

  	// verify the program is in memory
  	var index;
  	for(index = 0; index < program.length; index++) {
  		// expect the first memory address to contain the most significant 8 bits of the instruction
  		expect(emulator.memory[0x200 + index * 2]).toBe((program[index] & 0xFF00) >> 8);

  		// expect the second memory address to contain the least significant 8 bits of the instruction
  		expect(emulator.memory[0x200 + index * 2 + 1]).toBe(program[index] & 0x00FF);
  	}

  	// verify program counter is pointed at 0x200
  	expect(emulator.programCounter).toBe(0x200);

	});

	it('reads first opcode', function() {
		// push some instructions to memory

		// clear screen
		emulator.memory[0] = 0x00; 
		emulator.memory[1] = 0xE0;

		// read the opcode
		var opcode = emulator.readNextOpcode();
		expect(opcode).toBe(0x00E0);
	});

	it('increments program counter', function() {
		// read the opcode
		emulator.readNextOpcode();
		emulator.readNextOpcode();
		expect(emulator.programCounter).toBe(4);
	});

	it('reads second instruction', function() {
		// push some instructions to memory

		emulator.memory[0] = 0x00; 
		emulator.memory[1] = 0x00;

		// clear screen
		emulator.memory[2] = 0x00; 
		emulator.memory[3] = 0xE0;

		// read the opcode
		emulator.readNextOpcode();
		emulator.readNextOpcode();
		expect(emulator.programCounter).toBe(4);
	});

	it('implements jump instruction', function() {
		// 1NNN - jump to address NNN
		emulator.memory[0] = 0x11;
		emulator.memory[1] = 0x23;

		emulator.processNextOpcode();

		expect(emulator.programCounter).toBe(0x0123);
	});

	describe('subroutines', function(){

		beforeEach(function() {
			// load a basic program into memory

			// 2NNN - call subroutine at NNN
			emulator.memory[0] = 0x21;
			emulator.memory[1] = 0x23;

			// clear screen
			emulator.memory[0x0123] = 0x00;
			emulator.memory[0x0124] = 0xE0;

			// 00EE - return from subroutine
			emulator.memory[0x0125] = 0x00;
			emulator.memory[0x0126] = 0xEE;
		});

		it('places correct memory address on stack', function() {
			var currentStackPointer = emulator.stackPointer;
			var currentProgramCounter = emulator.programCounter;
			var expectedProgramCounter = currentProgramCounter + 2;

			emulator.processNextOpcode(); // call subroutine

			// the location of the instruction to execute upon return should be on the stack
			// this should be the next instruction after the subroutine call instruction
			expect(emulator.stack[currentStackPointer]).toBe(expectedProgramCounter);
		});

		it('increments stack pointer', function() {
			var currentStackPointer = emulator.stackPointer;
			var currentProgramCounter = emulator.programCounter;
			var expectedProgramCounter = currentProgramCounter + 2;

			emulator.processNextOpcode(); // call subroutine

			// stack pointer is incremented
			expect(emulator.stackPointer).toBe(currentStackPointer + 1);
		});

		it('jumps to subroutine address', function() {
			emulator.processNextOpcode();  // call subroutine

			expect(emulator.programCounter).toBe(0x0123);
		});

		it('returns to correct address', function() {
			emulator.processNextOpcode(); // call subroutine
			emulator.processNextOpcode(); // clear screen
			emulator.processNextOpcode(); // return from subroutine

			expect(emulator.programCounter).toBe(2);
		});
	});

	describe('registers', function(){

		beforeEach(function(){
			// 6XNN - sets VX to NN

			// set V0 register to 42
			emulator.memory[0] = 0x60;
			emulator.memory[1] = 0x42;

			// set VD register to 01
			emulator.memory[2] = 0x6D;
			emulator.memory[3] = 0x01;

			emulator.processNextOpcode(); // set V0 register
			emulator.processNextOpcode(); // set VD register
		});

		it('sets register values', function() {
			expect(emulator.v[0]).toBe(0x42);
			expect(emulator.v[0xD]).toBe(0x01);
		});

		it('adds to register value', function() {
			// 7XNN - adds NN to VX
			emulator.memory[4] = 0x70;
			emulator.memory[5] = 0x08;

			emulator.processNextOpcode();

			expect(emulator.v[0]).toBe(0x4A);
		});

		it('copies register values', function(){
      // 8XY0 - sets VX to the value of VY

			// set V1 register to value of V0 register
			emulator.memory[4] = 0x81;
			emulator.memory[5] = 0x00;

			emulator.processNextOpcode(); // copy value from V0 to V1

			expect(emulator.v[1]).toBe(emulator.v[0]);
		});
	});

	describe('skips', function() {
		it('skips next instruction if equal to value', function(){
      // 3XNN - skip the next instruction if VX equals NN

			// set V0 register to 42
			emulator.memory[0] = 0x60;
			emulator.memory[1] = 0x42;

			// if equal to 42
			emulator.memory[2] = 0x30;
			emulator.memory[3] = 0x42;

			emulator.processNextOpcode(); // set register V0
			emulator.processNextOpcode(); // if register V0 == NN, skip

			expect(emulator.programCounter).toBe(6);
		});

		it('does not skip next instruction if not equal to value', function(){
      // 3XNN - skip the next instruction if VX equals NN

			// set V0 register to 42
			emulator.memory[0] = 0x60;
			emulator.memory[1] = 0x42;

			// if equal to 42
			emulator.memory[2] = 0x30;
			emulator.memory[3] = 0x43;

			emulator.processNextOpcode(); // set register V0
			emulator.processNextOpcode(); // if register V0 == NN, skip

			expect(emulator.programCounter).toBe(4);
		});

		it('skips next instruction if not equal to value', function(){
      // 4XNN - skip the next instruction if VX doesn't equal NN

			// set V0 register to 42
			emulator.memory[0] = 0x60;
			emulator.memory[1] = 0x42;

			// if not equal to 42
			emulator.memory[2] = 0x40;
			emulator.memory[3] = 0x43;

			emulator.processNextOpcode(); // set register V0
			emulator.processNextOpcode(); // if register V0 !== NN, skip

			expect(emulator.programCounter).toBe(6);
		});

		it('does not skip next instruction if equal to value', function(){
      // 4XNN - skip the next instruction if VX doesn't equal NN

			// set V0 register to 42
			emulator.memory[0] = 0x60;
			emulator.memory[1] = 0x42;

			// if not equal to 42
			emulator.memory[2] = 0x40;
			emulator.memory[3] = 0x42;

			emulator.processNextOpcode(); // set register V0
			emulator.processNextOpcode(); // if register V0 !== NN, skip

			expect(emulator.programCounter).toBe(4);
		});

		it('skips next instruction if registers are equal', function(){
      // 5XY0 - skip the next instruction if VX equals VY

			// set V0 register to 42
			emulator.memory[0] = 0x60;
			emulator.memory[1] = 0x42;

			// set V1 register to 42
			emulator.memory[2] = 0x61;
			emulator.memory[3] = 0x42;

			// if V0 and V1 contain same value, skip next instruction
			emulator.memory[4] = 0x50;
			emulator.memory[5] = 0x10;

			emulator.processNextOpcode(); // set register V0
			emulator.processNextOpcode(); // set register V1
			emulator.processNextOpcode(); // if register V0 == NN, skip

			expect(emulator.programCounter).toBe(8);
		});

		it('skips next instruction if registers are not equal', function(){
      // 9XY0 - skips the next instruction if VX doesn't equal VY

			// set V0 register to 42
			emulator.memory[0] = 0x60;
			emulator.memory[1] = 0x42;

			// set V1 register to 42
			emulator.memory[2] = 0x61;
			emulator.memory[3] = 0x43;

			// if V0 and V1 contain same value, skip next instruction
			emulator.memory[4] = 0x90;
			emulator.memory[5] = 0x10;

			emulator.processNextOpcode(); // set register V0
			emulator.processNextOpcode(); // set register V1
			emulator.processNextOpcode(); // if register V0 == NN, skip

			expect(emulator.programCounter).toBe(8);
		});

		it('does not skip next instruction if registers are equal', function(){
      // 9XY0 - skips the next instruction if VX doesn't equal VY

			// set V0 register to 42
			emulator.memory[0] = 0x60;
			emulator.memory[1] = 0x42;

			// set V1 register to 42
			emulator.memory[2] = 0x61;
			emulator.memory[3] = 0x42;

			// if V0 and V1 contain same value, skip next instruction
			emulator.memory[4] = 0x90;
			emulator.memory[5] = 0x10;

			emulator.processNextOpcode(); // set register V0
			emulator.processNextOpcode(); // set register V1
			emulator.processNextOpcode(); // if register V0 == NN, skip

			expect(emulator.programCounter).toBe(6);
		});

		it('jumps to NNN plus V0', function(){
      // BNNN - jumps to the address NNN plus V0

      // set V0 to 42
			emulator.memory[0] = 0x60;
			emulator.memory[1] = 0x42;

			// jump to V0 (42) + 211
			emulator.memory[2] = 0xB2;
			emulator.memory[3] = 0x11;

			emulator.processNextOpcode();
			emulator.processNextOpcode();

			expect(emulator.programCounter).toBe(0x253);
		});
	});

	describe('register operators', function(){
		// 0x8000 family of commands

		beforeEach(function() {

			// set V0 register to AA
			emulator.memory[0] = 0x60;
      emulator.memory[1] = 0xAA;

			// set V1 register to 0F
			emulator.memory[2] = 0x61;
      emulator.memory[3] = 0x0F;

      emulator.processNextOpcode(); // set V0 register
      emulator.processNextOpcode(); // set V1 register
		});

		it('ORs', function(){
      // 8XY1 - sets VX to VX OR VY
			emulator.memory[4] = 0x80;
			emulator.memory[5] = 0x11;
      
      emulator.processNextOpcode(); // V0 = V0 OR V1

      expect(emulator.v[0]).toBe(0xAF);
		});

		it('ANDs', function(){
      // 8XY2 - sets VX to VX AND VY
			emulator.memory[4] = 0x80;
			emulator.memory[5] = 0x12;
      
      emulator.processNextOpcode(); // V0 = V0 AND V1

      expect(emulator.v[0]).toBe(0x0A);
		});

		it('XORs', function(){
      // 8XY3 - sets VX to VX XOR VY
			emulator.memory[4] = 0x80;
			emulator.memory[5] = 0x13;
      
      emulator.processNextOpcode(); // V0 = V0 XOR V1

      expect(emulator.v[0]).toBe(0xA5);
		});

		it('adds without carry', function(){
	    // 8XY4 - adds VY to VX. VF is set to 1 when there's a carry, and to 0 when there isn't
			emulator.memory[4] = 0x80;
			emulator.memory[5] = 0x14;
      
      emulator.processNextOpcode(); // V0 = V0 + V1

      expect(emulator.v[0]).toBe(0xB9);

      // also expect the "carry" flag not to be set
      expect(emulator.v[0xf]).toBe(0);
		});

		it('adds with carry', function(){
	    // 8XY4 - adds VY to VX. VF is set to 1 when there's a carry, and to 0 when there isn't

			// set V2 register to FF
			emulator.memory[4] = 0x62;
      emulator.memory[5] = 0xFF;

      // add V2 to V0
			emulator.memory[6] = 0x80;
			emulator.memory[7] = 0x24;
      
      emulator.processNextOpcode(); // set V2 register
      emulator.processNextOpcode(); // V0 = V0 + V2

      expect(emulator.v[0]).toBe(0xA9);

      // also expect the "carry" flag not to be set
      expect(emulator.v[0xf]).toBe(1);
		});

		it('subtracts VY from VX without borrow', function(){
      // 8XY5 - VY is subtracted from VX. VF is set to 0 when there's a borrow, and 1 when there isn't.
			emulator.memory[4] = 0x80;
			emulator.memory[5] = 0x15;
      
      emulator.processNextOpcode(); // V0 = V0 - V1

      expect(emulator.v[0]).toBe(0x9B);

      // also expect the "borrow" to be set to 1 (indicating no borrow)
      expect(emulator.v[0xf]).toBe(1);
		});

		it('subtracts VY from VX with borrow', function(){
      // 8XY5 - VY is subtracted from VX. VF is set to 0 when there's a borrow, and 1 when there isn't.

			// set V2 register to FF
			emulator.memory[4] = 0x62;
      emulator.memory[5] = 0xFF;

      // subtract V2 from V0
			emulator.memory[6] = 0x80;
			emulator.memory[7] = 0x25;
      
      emulator.processNextOpcode(); // set V2 register
      emulator.processNextOpcode(); // V0 = V0 - V2

      expect(emulator.v[0]).toBe(0xAA);

      // also expect the "borrow" to be set to 0 (indicating a borrow)
      expect(emulator.v[0xf]).toBe(0);
		});

		it('subtracts VX from VY with borrow', function(){
      // 8XY7 - sets VX to VY minus VX. VF is set to 0 when there's a borrow, and 1 when there isn't
			emulator.memory[4] = 0x80;
			emulator.memory[5] = 0x17;
      
      emulator.processNextOpcode(); // V0 = V1 - V0

      expect(emulator.v[0]).toBe(0x64);

      // also expect the "borrow" to be set to 0 (indicating a borrow)
      expect(emulator.v[0xf]).toBe(0);
		});

		it('subtracts VX from VY without borrow', function(){
      // 8XY7 - sets VX to VY minus VX. VF is set to 0 when there's a borrow, and 1 when there isn't
			emulator.memory[4] = 0x81;
			emulator.memory[5] = 0x07;
      
      emulator.processNextOpcode(); // V1 = V0 - V1

      expect(emulator.v[1]).toBe(0x9B);

      // also expect the "borrow" to be set to 1 (indicating no borrow)
      expect(emulator.v[0xf]).toBe(1);
		});

		it('shifts right with VF 0', function() {
      // 8XY6 - Shifts VX right by one. VF is set to the value of the least significant bit of VX before the shift

      // set V2 to 7A
      emulator.memory[4] = 0x62;
      emulator.memory[5] = 0x7A;

			emulator.memory[6] = 0x82; // shift V2 right by 1
      emulator.memory[7] = 0x06;

      emulator.processNextOpcode();
      emulator.processNextOpcode(); // shift V0 right by 1

      expect(emulator.v[2]).toBe(0x3D);

      expect(emulator.v[0xf]).toBe(0);
		});

		it('shifts right with VF 0', function() {
      // 8XY6 - Shifts VX right by one. VF is set to the value of the least significant bit of VX before the shift
			emulator.memory[4] = 0x81; // shift V1 right by 1
      emulator.memory[5] = 0x06;

      emulator.processNextOpcode();

      expect(emulator.v[1]).toBe(0x07);

      expect(emulator.v[0xf]).toBe(1);
		});

		it('shifts left with VF 0', function() {
      // 8XYE - shifts VX left by one. VF is set to the value of the most significant bit of VS before the shift
			emulator.memory[4] = 0x81; // shift V0 left by 1
      emulator.memory[5] = 0x0E;

      emulator.processNextOpcode();

      expect(emulator.v[1]).toBe(0x1E);

      expect(emulator.v[0xf]).toBe(0);
		});

		it('shifts left with VF 1', function() {
      // 8XYE - shifts VX left by one. VF is set to the value of the most significant bit of VS before the shift
			emulator.memory[4] = 0x80; // shift V0 left by 1
      emulator.memory[5] = 0x0E;

      emulator.processNextOpcode();

      expect(emulator.v[0]).toBe(0x54);

      expect(emulator.v[0xf]).toBe(1);
		});
	});

	it('sets I', function(){
    // ANNN - sets I to the address NNN
		emulator.memory[0] = 0xA2;
		emulator.memory[1] = 0xAB;

		emulator.processNextOpcode();

		expect(emulator.i).toBe(0x2AB);
	});

	it('adds VX to I without carry', function (){
    // FX1E - adds VX to I

    // set VX to 0x07
		emulator.memory[0] = 0x60;
		emulator.memory[1] = 0x07;

		// set I to 2AB
		emulator.memory[2] = 0xA2;
		emulator.memory[3] = 0xAB;

		// add VX to I
		emulator.memory[4] = 0xF0;
		emulator.memory[5] = 0x1E;

		emulator.processNextOpcode();
		emulator.processNextOpcode();
		emulator.processNextOpcode();

		expect(emulator.i).toBe(0x2B2);
		expect(emulator.v[0xf]).toBe(0);
	});

	it('adds VX to I with carry', function (){
		// FX1E - adds VX to I

    // set VX to 0xF0
		emulator.memory[0] = 0x60;
		emulator.memory[1] = 0xF0;

		// set I to FAB
		emulator.memory[2] = 0xAF;
		emulator.memory[3] = 0xAB;

		// add VX to I
		emulator.memory[4] = 0xF0;
		emulator.memory[5] = 0x1E;

		emulator.processNextOpcode();
		emulator.processNextOpcode();
		emulator.processNextOpcode();

		expect(emulator.i).toBe(0x9B);
		expect(emulator.v[0xf]).toBe(1);
	});

	it('generates random number', function(){
    // CXNN - sets VX to a random number and NN
		emulator.memory[0] = 0xC0;
		emulator.memory[1] = 0x00;

		emulator.processNextOpcode();

		expect(emulator.v[0]).not.toBeUndefined();
	});

	describe('delay timer', function(){
		it('sets delay timer', function(){
      // FX15 - sets the delay timer to VX

      // store 0x15 in V0
      emulator.memory[0] = 0x60;
			emulator.memory[1] = 0x15;

			// set delay timer to 0x15
			emulator.memory[2] = 0xF0;
			emulator.memory[3] = 0x15;

			emulator.processNextOpcode();
			emulator.processNextOpcode();

			expect(emulator.delayTimer).toBe(0x15);
		});

		it('decrements delay timer', function(){
			// FX15 - sets the delay timer to VX

      // store 0x15 in V0
      emulator.memory[0] = 0x60;
			emulator.memory[1] = 0x15;

			// set delay timer to 0x15
			emulator.memory[2] = 0xF0;
			emulator.memory[3] = 0x15;

			emulator.processNextOpcode();
			emulator.processNextOpcode();

			// with every tick, the timer should decrement.
			emulator.processNextOpcode();
			expect(emulator.delayTimer).toBe(0x14);

			emulator.processNextOpcode();
			expect(emulator.delayTimer).toBe(0x13);
		});

		it('sets VX to the value of the delay timer', function(){
      // FX07 - sets VX to the value of the delay timer

			// set V0 to 15
      emulator.memory[0] = 0x60;
			emulator.memory[1] = 0x15;

			// set delay timer to V0
			emulator.memory[2] = 0xF0;
			emulator.memory[3] = 0x15;

			// set VX to the value of the delay timer
			emulator.memory[4] = 0xF0;
			emulator.memory[5] = 0x07;

			emulator.processNextOpcode(); // set V0 to 14
			emulator.processNextOpcode(); // set delay timer to 0x15
			emulator.processNextOpcode(); // set VX to the value of the delay timer

			// should decrement
			expect(emulator.v[0]).toBe(0x14);
		});
	});

	describe('sound timer', function(){
		it('sets sound timer', function(){
			// FX18 - sets the sound timer to VX

			// set V0 to 14
      emulator.memory[0] = 0x60;
			emulator.memory[1] = 0x14;

			// set sound timer to VX
			emulator.memory[2] = 0xF0;
			emulator.memory[3] = 0x18;

			emulator.processNextOpcode();
			emulator.processNextOpcode();

			expect(emulator.soundTimer).toBe(0x14);
		});

		it('decrements the sound timer', function(){
			// FX18 - sets the sound timer to VX

			// set V0 to 14
      emulator.memory[0] = 0x60;
			emulator.memory[1] = 0x14;

			// set sound timer to VX
			emulator.memory[2] = 0xF0;
			emulator.memory[3] = 0x18;

			emulator.processNextOpcode();
			emulator.processNextOpcode();

			// should decrement
			emulator.processNextOpcode();
			expect(emulator.soundTimer).toBe(0x13);

			emulator.processNextOpcode();
			expect(emulator.soundTimer).toBe(0x12);
		});
	});

	describe('input', function(){
		it('sets current key', function() {
			emulator.keypress(0xF);
			expect(emulator.currentKey).toBe(0xF);
		});

		it('un-sets current key', function() {
			emulator.keypress(0xF);
			emulator.keyup(0xF);
			expect(emulator.currentKey).toBe(null);
		});

		it('awaits key press', function(){
      // FX0A - a key press is awaited, and then stored in VX
      emulator.memory[0] = 0xF0;
			emulator.memory[1] = 0x0A;

			emulator.tick(); // instruction to await keypress

			var currentProgramCounter = emulator.programCounter;

			emulator.tick(); // should do nothing
			emulator.tick(); // should do nothing

			expect(emulator.programCounter).toBe(currentProgramCounter);

			// send a key press
			emulator.keypress(0);
			emulator.tick();

			// should be on the next instruction now
			expect(emulator.programCounter).toBe(currentProgramCounter + 2);
		});

		it('skips the next instruction if the key stored in VX is pressed', function(){
      // EX9E - skips the next instruction if the key stored in VX is pressed

      // store 0x8 in V0
      emulator.memory[0] = 0x60;
      emulator.memory[1] = 0x08;

      // skip the next instruction if 0 is pressed
      emulator.memory[2] = 0xE0;
      emulator.memory[3] = 0x9E;

      // this instruction (set V8 to AA) should be ignored
      emulator.memory[4] = 0x68;
      emulator.memory[5] = 0xAA;

      emulator.keypress(8); // send key press event

      emulator.tick(); // store 0x8 in V0
      emulator.tick(); // skip the next instruction if 8 is pressed (which it is)
      emulator.tick(); // store AA in V1 (shouldn't do it)

      expect(emulator.v[8]).not.toBe(0xAA);
		});

		it('does not skip the next instruction if the key stored in VX is not pressed', function(){
      // EX9E - skips the next instruction if the key stored in VX is pressed

      // store 0x0 in V0
      emulator.memory[0] = 0x60;
      emulator.memory[1] = 0x00;

      // skip the next instruction if 0 is pressed
      emulator.memory[2] = 0xE0;
      emulator.memory[3] = 0x9E;

      // this instruction (set V8 to AA) should be ignored
      emulator.memory[4] = 0x68;
      emulator.memory[5] = 0xAA;

      emulator.tick(); // store 0x0 in V0
      emulator.tick(); // skip the next instruction if 0 is pressed (which it is)
      emulator.tick(); // store AA in V1 (shouldn't do it)

      expect(emulator.v[8]).toBe(0xAA);
		});

		it('skips the next instruction if the key stored in VX is not pressed - no keypress', function(){
      // EXA1 - skips the next instruction if the key stored in VX isn't pressed

      // store 0x0 in V0
      emulator.memory[0] = 0x60;
      emulator.memory[1] = 0x00;

      // skip the next instruction if 0 is not pressed
      emulator.memory[2] = 0xE0;
      emulator.memory[3] = 0xA1;

      // this instruction (set V8 to AA) should be ignored
      emulator.memory[4] = 0x68;
      emulator.memory[5] = 0xAA;

      emulator.tick(); // store 0x0 in V0
      emulator.tick(); // skip the next instruction if 0 is pressed (which it is)
      emulator.tick(); // store AA in V1 (shouldn't do it)

      expect(emulator.v[8]).not.toBe(0xAA);
		});

		it('skips the next instruction if the key stored in VX is not pressed - other keypress', function(){
      // EXA1 - skips the next instruction if the key stored in VX isn't pressed

      // store 0x0 in V0
      emulator.memory[0] = 0x60;
      emulator.memory[1] = 0x00;

      // skip the next instruction if 0 is not pressed
      emulator.memory[2] = 0xE0;
      emulator.memory[3] = 0xA1;

      // this instruction (set V8 to AA) should be ignored
      emulator.memory[4] = 0x68;
      emulator.memory[5] = 0xAA;

      emulator.keypress(1);

      emulator.tick(); // store 0x0 in V0
      emulator.tick(); // skip the next instruction if 0 is pressed (which it is)
      emulator.tick(); // store AA in V1 (shouldn't do it)

      expect(emulator.v[8]).not.toBe(0xAA);
		});
	});

	describe('sprites', function(){
		it('sets I to the location of the sprite for character stored in VX - 0', function(){
      // FX29 - sets I to the location of the sprite for the character in VX. 

      // set V0 to 0
			emulator.memory[0] = 0x60;
			emulator.memory[1] = 0x00;

			// set I to location of sprite for 0 (stored in V0)
			emulator.memory[2] = 0xF0;
			emulator.memory[3] = 0x29;

			emulator.tick(); // set V0 to 0
			emulator.tick(); // set I to location of sprite for 0

			// the sprite data for this character starts at memory address 0x0
			expect(emulator.i).toBe(0);
		});

		it('sets I to the location of the sprite for character stored in VX - A', function(){
      // FX29 - sets I to the location of the sprite for the character in VX. 

      // set V5 to A
			emulator.memory[0] = 0x65;
			emulator.memory[1] = 0x0A;

			// set I to location of sprite for A (stored in V5)
			emulator.memory[2] = 0xF5;
			emulator.memory[3] = 0x29;

			emulator.tick(); // set V5 to A
			emulator.tick(); // set I to location of sprite for A

			// the sprite data for this character starts at memory address 0xA * 5 
			// (since each character takes 5 bytes of memory)
			expect(emulator.i).toBe(0xA * 5);
		});

		it('stores the BCD representation of VX - 3 digits', function(){
			// FX33 - stores the binary-coded decimal representation of VX, with the 
      // most significant of three digits at the address in I, the middle digit 
      // at I plus 1, and the least significant digit at I plus 2.

      // set V0 to a value
      emulator.v[0] = 0xFE; // 254

      // store the BCD starting at 0x500
      emulator.i = 0x500;

      // tell Chip8 to store BCD represenation of what's in V0 in memroy starting
      // at address stored in I
      emulator.memory[0] = 0xF0;
      emulator.memory[1] = 0x33;

      emulator.tick();

      // 0xFE is 254, so 0x500 should be 2
      expect(emulator.memory[0x500]).toBe(2);

      // 0x501 should be 5
      expect(emulator.memory[0x501]).toBe(5);

      // 0x502 should be 4
      expect(emulator.memory[0x502]).toBe(4);
		});

		it('stores the BCD representation of VX - 2 digits', function(){
			// FX33 - stores the binary-coded decimal representation of VX, with the 
      // most significant of three digits at the address in I, the middle digit 
      // at I plus 1, and the least significant digit at I plus 2.

      // set V0 to a value
      emulator.v[0] = 0x0F;

      // store the BCD starting at 0x500
      emulator.i = 0x500;

      // tell Chip8 to store BCD represenation of what's in V0 in memroy starting
      // at address stored in I
      emulator.memory[0] = 0xF0;
      emulator.memory[1] = 0x33;

      emulator.tick();

      expect(emulator.memory[0x500]).toBe(1);

      // following memory should be untouched
      expect(emulator.memory[0x501]).toBe(5);
      expect(emulator.memory[0x502]).toBeUndefined();
		});

		it('stores the BCD representation of VX - 1 digit', function(){
			// FX33 - stores the binary-coded decimal representation of VX, with the 
      // most significant of three digits at the address in I, the middle digit 
      // at I plus 1, and the least significant digit at I plus 2.

      // set V0 to a value
      emulator.v[0] = 0x07;

      // store the BCD starting at 0x500
      emulator.i = 0x500;

      // tell Chip8 to store BCD represenation of what's in V0 in memroy starting
      // at address stored in I
      emulator.memory[0] = 0xF0;
      emulator.memory[1] = 0x33;

      emulator.tick();

      expect(emulator.memory[0x500]).toBe(7);

      // following memory should be untouched
      expect(emulator.memory[0x502]).toBeUndefined();
      expect(emulator.memory[0x502]).toBeUndefined();
		});

		it('stores the BCD representation of VX - 0', function(){
			// FX33 - stores the binary-coded decimal representation of VX, with the 
      // most significant of three digits at the address in I, the middle digit 
      // at I plus 1, and the least significant digit at I plus 2.

      // set V0 to a value
      emulator.v[0] = 0x00;

      // store the BCD starting at 0x500
      emulator.i = 0x500;

      // tell Chip8 to store BCD represenation of what's in V0 in memroy starting
      // at address stored in I
      emulator.memory[0] = 0xF0;
      emulator.memory[1] = 0x33;

      emulator.tick();

      expect(emulator.memory[0x500]).toBe(0);

      // following memory should be untouched
      expect(emulator.memory[0x501]).toBeUndefined();
      expect(emulator.memory[0x502]).toBeUndefined();
		});

		it('draws a sprite', function(){
      // DXYN - draws a sprite at coordinate (VX, VY) that has a width of 8 pixels 
      // and a height of N pixels.

      // sprite drawing starts at I
			emulator.i = 0x400;

			// set up sprite data - a triangle of sorts
			emulator.memory[emulator.i] = 0x18;
			emulator.memory[emulator.i + 1] = 0x24;
			emulator.memory[emulator.i + 2] = 0x42;
			emulator.memory[emulator.i + 3] = 0x81;
			emulator.memory[emulator.i + 4] = 0xFF;

      // draw a sprite starting at 5, 4 with 5 bytes of data (5 rows).
      emulator.v[0] = 5;
      emulator.v[1] = 4;
			emulator.memory[0] = 0xD0;
			emulator.memory[1] = 0x15;

			emulator.tick();

			// first row - 0x18
			expect(emulator.graphicsData[5] [4]).toBe(0);
			expect(emulator.graphicsData[6] [4]).toBe(0);
			expect(emulator.graphicsData[7] [4]).toBe(0);
			expect(emulator.graphicsData[8] [4]).toBe(1);
			expect(emulator.graphicsData[9] [4]).toBe(1);
			expect(emulator.graphicsData[10][4]).toBe(0);
			expect(emulator.graphicsData[11][4]).toBe(0);
			expect(emulator.graphicsData[12][4]).toBe(0);

			// second row - 0x24
			expect(emulator.graphicsData[5][5]).toBe(0);
			expect(emulator.graphicsData[6][5]).toBe(0);
			expect(emulator.graphicsData[7][5]).toBe(1);
			expect(emulator.graphicsData[8][5]).toBe(0);
			expect(emulator.graphicsData[9][5]).toBe(0);
			expect(emulator.graphicsData[10][5]).toBe(1);
			expect(emulator.graphicsData[11][5]).toBe(0);
			expect(emulator.graphicsData[12][5]).toBe(0);

			// third row - 0x42
			expect(emulator.graphicsData[5][6]).toBe(0);
			expect(emulator.graphicsData[6][6]).toBe(1);
			expect(emulator.graphicsData[7][6]).toBe(0);
			expect(emulator.graphicsData[8][6]).toBe(0);
			expect(emulator.graphicsData[9][6]).toBe(0);
			expect(emulator.graphicsData[10][6]).toBe(0);
			expect(emulator.graphicsData[11][6]).toBe(1);
			expect(emulator.graphicsData[12][6]).toBe(0);
 
			// fourth row - 0x81 
			expect(emulator.graphicsData[5][7]).toBe(1);
			expect(emulator.graphicsData[6][7]).toBe(0);
			expect(emulator.graphicsData[7][7]).toBe(0);
			expect(emulator.graphicsData[8][7]).toBe(0);
			expect(emulator.graphicsData[9][7]).toBe(0);
			expect(emulator.graphicsData[10][7]).toBe(0);
			expect(emulator.graphicsData[11][7]).toBe(0);
			expect(emulator.graphicsData[12][7]).toBe(1);
 
			// fifth row - 0xFF 
			expect(emulator.graphicsData[5][8]).toBe(1);
			expect(emulator.graphicsData[6][8]).toBe(1);
			expect(emulator.graphicsData[7][8]).toBe(1);
			expect(emulator.graphicsData[8][8]).toBe(1);
			expect(emulator.graphicsData[9][8]).toBe(1);
			expect(emulator.graphicsData[10][8]).toBe(1);
			expect(emulator.graphicsData[11][8]).toBe(1);
			expect(emulator.graphicsData[12][8]).toBe(1);
		});

		it('flips pixels when drawn', function(){
      // DXYN - draws a sprite at coordinate (VX, VY) that has a width of 8 pixels 
      // and a height of N pixels.

      // sprite drawing starts at I
			emulator.i = 0x400;

			// set up sprite data - a triangle of sorts
			emulator.memory[emulator.i] = 0x18;

      // draw a sprite starting at 0, 0 with 1 byte of data.
			emulator.memory[0] = 0xD0;
			emulator.memory[1] = 0x01;

			// do it again, which should flip it all back to 0
			emulator.v[0] = 0;
			emulator.memory[2] = 0xD0;
			emulator.memory[3] = 0x01;

			emulator.tick();
			emulator.tick();

			// graphics data should be clear
			expect(emulator.graphicsData[0][0]).toBe(0);
			expect(emulator.graphicsData[0][1]).toBe(0);
			expect(emulator.graphicsData[0][2]).toBe(0);
			expect(emulator.graphicsData[0][3]).toBe(0);
			expect(emulator.graphicsData[0][4]).toBe(0);
			expect(emulator.graphicsData[0][5]).toBe(0);
			expect(emulator.graphicsData[0][6]).toBe(0);
			expect(emulator.graphicsData[0][7]).toBe(0);
		});

		it('clears the screen', function(){
      // 00E0 - clears the screen

      // sprite drawing starts at I
			emulator.i = 0x400;

			// set up sprite data - a triangle of sorts
			emulator.memory[emulator.i] = 0x18;

      // draw a sprite starting at 0, 0 with 1 byte of data.
			emulator.memory[0] = 0xD0;
			emulator.memory[1] = 0x01;

			// clear the screen
			emulator.memory[0] = 0x00;
			emulator.memory[1] = 0xE0;

			emulator.tick(); // draw to the screen
			emulator.tick(); // clear the screen

			expect(emulator.graphicsData[0][0]).toBe(0);
			expect(emulator.graphicsData[0][1]).toBe(0);
			expect(emulator.graphicsData[0][2]).toBe(0);
			expect(emulator.graphicsData[0][3]).toBe(0);
			expect(emulator.graphicsData[0][4]).toBe(0);
			expect(emulator.graphicsData[0][5]).toBe(0);
			expect(emulator.graphicsData[0][6]).toBe(0);
			expect(emulator.graphicsData[0][7]).toBe(0);
		});
	});

	describe('memory-registry copy functions', function(){
		it('stores V0 to VF in memory', function(){
      // FX55 - stores V0 to VX in memory starting at address I
			var index;

      // fill the V registers with values
      for (index = 0; index <= 0xF; index++) {
      	emulator.v[index] = 0xF0 + index;
      }

      // copy the values into memory starting at I
      emulator.i = 0x400;

      // copy V0 to VF into memory
      emulator.memory[0] = 0xFF;
      emulator.memory[1] = 0x55;

      emulator.tick();

			for (index = 0; index <= 0xF; index++) {
      	expect(emulator.memory[emulator.i + index]).toBe(0xF0 + index);
      }
		});

		it('stores V0 to V5 in memory', function(){
      // FX55 - stores V0 to VX in memory starting at address I

      // fill the V registers with values
      for (var index = 0; index <= 0xF; index++) {
      	emulator.v[index] = 0xF0 + index;
      }

      // copy the values into memory starting at I
      emulator.i = 0x400;

      // copy V0 to V5 into memory
      emulator.memory[0] = 0xF5;
      emulator.memory[1] = 0x55;

      emulator.tick();

      // memory should be set
			for (index = 0; index <= 0x5; index++) {
      	expect(emulator.memory[emulator.i + index]).toBe(0xF0 + index);
      }

      // this memory should remain untouched
			for (index = 0x6; index <= 0xF; index++) {
      	expect(emulator.memory[emulator.i + index]).toBeUndefined();
      }
		});

		it('fills V0 to VF from memory', function(){
      // FX65 - fills V0 to VX with values from memory starting at address I
			var index;

      // copy the values from memory starting at I
      emulator.i = 0x400;

      // fill some memory with values
      for (index = 0; index <= 0xF; index++) {
      	emulator.memory[emulator.i + index] = 0xF0 + index;
      }

      // copy from memory into V0 to VF
      emulator.memory[0] = 0xFF;
      emulator.memory[1] = 0x65;

      emulator.tick();

			for (index = 0; index <= 0xF; index++) {
      	expect(emulator.v[index]).toBe(0xF0 + index);
      }
		});

		it('fills V0 to V5 from memory', function(){
      // FX65 - fills V0 to VX with values from memory starting at address I
			var index;

      // copy the values from memory starting at I
      emulator.i = 0x400;

      // fill some memory with values
      for (index = 0; index <= 0xF; index++) {
      	emulator.memory[emulator.i + index] = 0xF0 + index;
      }

      // copy from memory into V0 to VF
      emulator.memory[0] = 0xF5;
      emulator.memory[1] = 0x65;

      emulator.tick();

			for (index = 0; index <= 0x5; index++) {
      	expect(emulator.v[index]).toBe(0xF0 + index);
      }

			for (index = 0x6; index <= 0xF; index++) {
      	expect(emulator.v[index]).toBeUndefined();
      }
		});
	});

});