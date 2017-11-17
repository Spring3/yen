# -*- mode: ruby -*-
# vi: set ft=ruby :

# All Vagrant configuration is done below. The "2" in Vagrant.configure
# configures the configuration version (we support older styles for
# backwards compatibility). Please don't change it unless you know what
# you're doing.

auto = ENV['AUTO_START_SWARM'] || false
vagrant_dir = File.expand_path(File.dirname(__FILE__))
# Increase numworkers if you want more than 3 nodes
numworkers = 2

# VirtualBox settings
# Increase vmmemory if you want more than 512mb memory in the vm's
vmmemory = {{ram}}
# Increase numcpu if you want more cpu's per vm
numcpu = {{cpus}}
cpuexecutioncap = {{cpuPercentage}}

instances = []

(1..numworkers).each do |n| 
  instances.push({:name => "worker#{n}", :ip => "192.168.10.#{n+2}"})
end

manager_ip = "192.168.10.2"

File.open("./hosts", 'w') { |file| 
  instances.each do |i|
    file.write("#{i[:ip]} #{i[:name]} #{i[:name]}\n")
  end
}

Vagrant.configure("2") do |config|
    config.vm.provider "virtualbox" do |v|
      v.memory = vmmemory
      v.cpus = numcpu
      v.customize ["modifyvm", :id, "--cpuexecutioncap", cpuexecutioncap]
      if File.exists?(File.join(vagrant_dir,'Customfile')) then
        eval(IO.read(File.join(vagrant_dir,'Customfile')), binding)
      end
    end
    
    config.vm.define "manager" do |i|
      i.vm.box = "ubuntu/trusty64"
      i.vm.hostname = "manager"
      i.vm.network "private_network", ip: "#{manager_ip}"
      i.vm.provision "shell", path: "./provision.sh"
      if File.file?("./hosts") 
        i.vm.provision "file", source: "hosts", destination: "/tmp/hosts"
        i.vm.provision "shell", inline: "cat /tmp/hosts >> /etc/hosts", privileged: true
      end 
      if auto 
        i.vm.provision "shell", inline: "docker swarm init --advertise-addr #{manager_ip}"
        i.vm.provision "shell", inline: "docker swarm join-token -q worker > /vagrant/token"
      end
      i.vm.provision "shell", path: "./prometheus.sh"
    end 

  instances.each do |instance| 
    config.vm.define instance[:name] do |i|
      i.vm.box = "ubuntu/trusty64"
      i.vm.hostname = instance[:name]
      i.vm.network "private_network", ip: "#{instance[:ip]}"
      i.vm.provision "shell", path: "./provision.sh"
      if File.file?("./hosts") 
        i.vm.provision "file", source: "hosts", destination: "/tmp/hosts"
        i.vm.provision "shell", inline: "cat /tmp/hosts >> /etc/hosts", privileged: true
      end 
      if auto
        i.vm.provision "shell", inline: "docker swarm join --advertise-addr #{instance[:ip]} --listen-addr #{instance[:ip]}:2377 --token `cat /vagrant/token` #{manager_ip}:2377"
      end
    end 
  end
end
