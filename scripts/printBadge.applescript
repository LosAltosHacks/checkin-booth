on run argv
	if (count of argv) < 2 or (count of argv) > 3 then
		return "Usage: osascript printBadge.applescript firstName lastName [qrData]"
	else if (count of argv) = 2 then
		printPlainBadge(argv)
	else
		printQRBadge(argv)
	end if
end run

to printQRBadge({firstName, lastName, qrData})
	tell application "DYMO Label"
		openLabel in POSIX path of ((path to me as text) & "::qrBadge.label")
		set content of print object "firstName" to firstName
		set content of print object "lastName" to lastName
		set barcodeText of print object "qrCode" to qrData
		printLabel
	end tell
end printQRBadge

to printPlainBadge({firstName, lastName})
	tell application "DYMO Label"
		openLabel in POSIX path of ((path to me as text) & "::plainBadge.label")
		set content of print object "firstName" to firstName
		set content of print object "lastName" to lastName
		printLabel
	end tell
end printPlainBadge