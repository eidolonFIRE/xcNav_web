
function Sounds()
{
	// public:
	// speak, playMessageReceivedSound, playMessageSentSound, playEmergencySound
	
	// -----------------------------------------------------
	// text to speech		
	// quickie text to speech function using API that should work across 
	// IOS and Android and desktop Chrome/Safari	
	this.speak = function( msg: string, voiceName: string ="Samantha", rate: number =0.8, pitch: number =0.9 )
	{
		// instantiate on demand - probably mem heavy and slow and only rarely used
		let synth = window.speechSynthesis;
		let availableVoices: SpeechSynthesisVoice[] = synth.getVoices();

		if (synth.speaking) {
			console.error('speechSynthesis.speaking already');
			return;
		}
		if (msg !== '') 
		{
			let defaultVoice;
			let voice: SpeechSynthesisVoice;
			for( let i in availableVoices )
			{
				voice = availableVoices[i];
				if( voice.name == voiceName )
					break;
				if( voice.default )
					defaultVoice = voice;
			}
		
			voice = voice || defaultVoice;;
	
			let utterThis = new SpeechSynthesisUtterance(msg);
			utterThis.onend = function (event) { if(0)console.log('SpeechSynthesisUtterance.onend'); }
			utterThis.onerror = function (event) { console.error('SpeechSynthesisUtterance.onerror'); }
			utterThis.voice = voice;
			utterThis.pitch = pitch;
			utterThis.rate  = rate;
			synth.speak(utterThis);
		}
	}
	
	
	// -----------------------------------------------------
	// sounds
	// -----------------------------------------------------
	
	this.playMessageReceivedSound = function()
	{
		if( G.messages.isMessageInterfaceVisible() )
			$("#messageReceivedSound").play();
		else
			$("#alertMessageReceivedSound").play();
	}

	this.playMessageSentSound = function()
	{
		$("#messageSentSound").play();
	}

	this.playEmergencySound = function()
	{
		$("#emergencySound").play();
	}

}

G.sounds = new Sounds();




