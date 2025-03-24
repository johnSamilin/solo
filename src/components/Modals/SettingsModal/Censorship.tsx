import { FC, useState } from "react";
import { useStore } from "../../../stores/StoreProvider";

type CensorshipProps = {

};

export const Censorship: FC<CensorshipProps> = () => {
	const [pin, setPin] = useState('');
	const [currentPin, setCurrentPin] = useState('');
  const { settingsStore } = useStore();

		const handleSetPin = () => {
			if (pin.length < 4) return;
			settingsStore.setCensorshipPin(pin);
			setPin('');
		};
	
		const handleDisableCensorship = () => {
			if (!settingsStore.censorship.pin) return;
			settingsStore.disableCensorship(currentPin);
			setCurrentPin('');
		};

	return (
		<div className="settings-group">
			<h3>Censorship Settings</h3>
			{!settingsStore.censorship.pin ? (
				<div className="setting-item">
					<label>Set PIN Code</label>
					<div className="pin-input-group">
						<input
							type="password"
							value={pin}
							onChange={(e) => setPin(e.target.value)}
							className="pin-input"
							placeholder="Enter PIN"
						/>
						<button onClick={handleSetPin} className="button-primary">
							Set PIN
						</button>
					</div>
				</div>
			) : (
				<div className="setting-item">
					<label>Disable Censorship</label>
					<div className="pin-input-group">
						<input
							type="password"
							value={currentPin}
							onChange={(e) => setCurrentPin(e.target.value)}
							className="pin-input"
							placeholder="Enter PIN"
						/>
						<button onClick={handleDisableCensorship} className="button-primary">
							Turn Off
						</button>
					</div>
				</div>
			)}
			<div className="censorship-status">
				Status: {(settingsStore.fakeCensorshipDisabled || !settingsStore.censorship.enabled) ? 'Disabled' : 'Enabled'}
			</div>
			{(settingsStore.fakeCensorshipDisabled || !settingsStore.censorship.enabled) && <div className="setting-item">
				<button
					onClick={() => settingsStore.enableCensorship()}
					className="button-primary"
				>
					Enable Censorship
				</button>
			</div>}
		</div>
	);
};
