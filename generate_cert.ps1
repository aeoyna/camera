$cert = New-SelfSignedCertificate -DnsName "localhost", "192.168.3.218" -CertStoreLocation "cert:\CurrentUser\My"
$password = ConvertTo-SecureString -String "pass" -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath "server.pfx" -Password $password
Write-Host "Certificate generated successfully."
