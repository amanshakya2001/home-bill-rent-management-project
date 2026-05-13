IPHONE_UDID := 00008110-00010480029A201E
SIMULATOR_UDID := FB50A570-9F2F-448A-BDC0-1BC6B2F60A50

.PHONY: install ios ios-release android simulator open-sim push

# Install dependencies
install:
	npm install

# Run on iPhone simulator (debug)
simulator:
	xcrun simctl boot $(SIMULATOR_UDID) 2>/dev/null || true
	open -a Simulator
	npx expo run:ios -d $(SIMULATOR_UDID)

# Run on Aman's iPhone (debug)
ios:
	npx expo run:ios -d $(IPHONE_UDID)

# Install release build on Aman's iPhone
ios-release:
	npx expo run:ios -d $(IPHONE_UDID) --configuration Release

# Run on Android
android:
	npx expo run:android

# Start Metro bundler only
start:
	npx expo start

# Push to remote
push:
	git push origin master

# Clean Xcode derived data
clean:
	rm -rf ~/Library/Developer/Xcode/DerivedData/HomeManager-*
	@echo "Cleaned Xcode derived data"

# Clean and reinstall node_modules
reset:
	rm -rf node_modules
	npm install
