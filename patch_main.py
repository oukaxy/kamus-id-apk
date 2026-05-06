import os, glob

# Cari MainActivity
files = glob.glob('android/**/MainActivity.kt', recursive=True) + \
        glob.glob('android/**/MainActivity.java', recursive=True)

if not files:
    print("ERROR: MainActivity tidak ditemukan")
    exit(1)

path = files[0]
print(f"Patching: {path}")

if path.endswith('.kt'):
    content = """package com.kamu.id

import android.os.Bundle
import com.getcapacitor.BridgeActivity
import com.capacitorjs.plugins.filesystem.FilesystemPlugin

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(FilesystemPlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}
"""
else:
    content = """package com.kamu.id;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.capacitorjs.plugins.filesystem.FilesystemPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FilesystemPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
"""

with open(path, 'w') as f:
    f.write(content)

print("Done - FilesystemPlugin registered")
